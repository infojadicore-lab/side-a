// Backwards-compatible re-export: the GIS button now lives in shared components
// so both the public app (board votes) and admin app use one implementation.
export { SignInButton as GoogleSignIn, AUTH_EVENT } from '../components/SignInButton.js';
