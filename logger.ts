import fs from 'fs';
import path from 'path';

export function logError(error: any) {
    const logPath = path.join(process.cwd(), 'server.log');
    const message = `[${new Date().toISOString()}] ERROR: ${error instanceof Error ? error.message : String(error)}\n${error instanceof Error ? error.stack : ''}\n\n`;
    fs.appendFileSync(logPath, message);
}
