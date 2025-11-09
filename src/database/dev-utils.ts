/**
 * Development utility to reset the database
 * Call this from the browser console if you encounter database version issues:
 *
 * import { resetDatabase } from './src/database/dev-utils'
 * await resetDatabase()
 */

export async function resetDatabase() {
    const dbName = "stream-drops-db";

    return new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);

        request.onsuccess = () => {
            console.log("✅ Database deleted successfully. Please refresh the page.");
            resolve();
        };

        request.onerror = () => {
            console.error("❌ Error deleting database:", request.error);
            reject(request.error);
        };

        request.onblocked = () => {
            console.warn("⚠️ Database deletion is blocked. Close all tabs with this app and try again.");
        };
    });
}

/**
 * Get current database version
 */
export async function getDatabaseVersion(): Promise<number> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("stream-drops-db");

        request.onsuccess = () => {
            const db = request.result;
            const version = db.version;
            db.close();
            console.log(`Current database version: ${version}`);
            resolve(version);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Make functions available in window for easy console access
if (typeof window !== 'undefined') {
    (window as unknown as { resetDatabase: typeof resetDatabase; getDatabaseVersion: typeof getDatabaseVersion }).resetDatabase = resetDatabase;
    (window as unknown as { resetDatabase: typeof resetDatabase; getDatabaseVersion: typeof getDatabaseVersion }).getDatabaseVersion = getDatabaseVersion;
}
