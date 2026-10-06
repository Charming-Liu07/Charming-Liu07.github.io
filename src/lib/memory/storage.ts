import type { Library } from './types.js';
import { emptyLibrary, validateLibrary } from './core.js';

const DATABASE = 'charming-local-memory';
const STORE = 'library';
const KEY = 'current';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('此浏览器无法使用 IndexedDB 本地存储'));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('无法打开本地存储'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('本地存储升级被其他页面阻止，请关闭其他博客页面后重试'));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (blocked) database.close();
      else resolve(database);
    };
  });
}

async function transact(updater?: (current: Library) => Library): Promise<Library> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(STORE, updater ? 'readwrite' : 'readonly');
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    let result: Library;
    let failure: unknown;
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      failure ??= transaction.error;
    };
    transaction.onabort = () => {
      database.close();
      reject(failure ?? transaction.error ?? new Error('本地存储事务已中止'));
    };
    const store = transaction.objectStore(STORE);
    const request = store.get(KEY);
    request.onerror = () => {
      failure = request.error;
    };
    request.onsuccess = () => {
      try {
        const current =
          request.result === undefined ? emptyLibrary() : validateLibrary(request.result);
        // The updater is synchronous so the transaction stays active from read through write.
        result = updater ? validateLibrary(updater(current)) : current;
        if (updater) {
          const write = store.put(result, KEY);
          write.onerror = () => {
            failure = write.error;
          };
        }
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
  });
}

export function readLibrary(): Promise<Library> {
  return transact();
}

export function updateLibrary(updater: (current: Library) => Library): Promise<Library> {
  return transact(updater);
}
