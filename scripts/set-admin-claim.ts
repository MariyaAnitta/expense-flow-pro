import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

// IMPORTANT: Path to your Service Account JSON file downloaded from Firebase Console
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

if (!SERVICE_ACCOUNT_PATH) {
    console.error('❌ Error: GOOGLE_APPLICATION_CREDENTIALS not found in .env.local');
    process.exit(1);
}

let app;
try {
    app = initializeApp({
        credential: cert(path.resolve(SERVICE_ACCOUNT_PATH))
    });
    console.log('✅ Firebase Admin initialized');
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
}

const auth = getAuth(app);

const setAdmin = async (email: string) => {
    try {
        const user = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(user.uid, { admin: true });
        console.log(`🚀 Success! User ${email} (UID: ${user.uid}) is now an Admin.`);
        console.log('💡 Note: The user must sign out and sign back in for the changes to take effect.');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error setting admin claim:', error.message);
        process.exit(1);
    }
};

const targetEmail = process.argv[2];

if (!targetEmail) {
    console.log('📖 Usage: npx tsx scripts/set-admin-claim.ts <user-email>');
    process.exit(1);
}

setAdmin(targetEmail);
