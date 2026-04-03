/**
 * Google Drive Picker integration for Cabino.
 */

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = process.env.VITE_GOOGLE_API_KEY;

// Scope for Google Drive Picker
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let tokenClient: any = null;
let accessToken: string | null = null;
let pickerApiLoaded = false;
let gisLoaded = false;
let initPromise: Promise<void> | null = null;

/**
 * Load the Google API and GIS scripts.
 */
export const initGoogleDrive = () => {
  if (initPromise) return initPromise;

  console.log('Initializing Google Drive APIs...');
  initPromise = new Promise<void>((resolve) => {
    const checkLoaded = () => {
      console.log('Checking if window.gapi and window.google are available...', { gapi: !!window.gapi, google: !!window.google });
      if (window.gapi && window.google) {
        // Initialize gapi
        console.log('Loading gapi client:picker...');
        window.gapi.load('client:picker', () => {
          console.log('gapi client:picker loaded.');
          pickerApiLoaded = true;
          if (gisLoaded) {
            console.log('Both Picker and GIS loaded, resolving.');
            resolve();
          }
        });

        // Initialize GIS
        console.log('Initializing Google Identity Services (GIS) token client...');
        try {
          tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined at request time
          });
          console.log('GIS token client initialized.');
          gisLoaded = true;
          if (pickerApiLoaded) {
            console.log('Both Picker and GIS loaded, resolving.');
            resolve();
          }
        } catch (err) {
          console.error('Error initializing GIS token client:', err);
        }
      } else {
        setTimeout(checkLoaded, 500);
      }
    };
    checkLoaded();
  });

  return initPromise;
};

/**
 * Open the Google Drive Picker.
 */
export const openPicker = async (): Promise<string[]> => {
  console.log('Attempting to open Google Picker...');
  console.log('VITE_GOOGLE_CLIENT_ID (Full):', CLIENT_ID || 'MISSING');
  console.log('VITE_GOOGLE_API_KEY (Masked):', API_KEY ? `${API_KEY.substring(0, 5)}...${API_KEY.substring(API_KEY.length - 5)}` : 'MISSING');

  if (!CLIENT_ID || !API_KEY) {
    throw new Error('Google Client ID or API Key is missing. Please check your environment variables.');
  }

  await initGoogleDrive();

  return new Promise((resolve, reject) => {
    const handleAuth = () => {
      console.log('Setting tokenClient callback...');
      tokenClient.callback = async (response: any) => {
        console.log('tokenClient callback received response:', response);
        if (response.error !== undefined) {
          console.error('Auth error:', response);
          reject(response);
          return;
        }
        accessToken = response.access_token;
        console.log('Access token received, creating picker...');
        createPicker(resolve, reject);
      };

      if (accessToken === null) {
        console.log('Requesting access token (consent)...');
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        console.log('Requesting access token (silent)...');
        tokenClient.requestAccessToken({ prompt: '' });
      }
    };

    handleAuth();
  });
};

/**
 * Create and render the Google Picker.
 */
const createPicker = (resolve: (urls: string[]) => void, reject: (err: any) => void) => {
  const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
  view.setMimeTypes('image/png,image/jpeg,image/jpg');

  console.log('Creating picker with origin: https://aistudio.google.com');
  const picker = new window.google.picker.PickerBuilder()
    .setOrigin('https://aistudio.google.com')
    .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
    .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
    .setDeveloperKey(API_KEY)
    .setAppId(CLIENT_ID.split('-')[0])
    .setOAuthToken(accessToken)
    .addView(view)
    .setCallback(async (data: any) => {
      console.log('Picker callback data:', data);
      if (data.action === window.google.picker.Action.PICKED) {
        const files = data.docs;
        try {
          const base64Images = await Promise.all(
            files.map((file: any) => downloadFile(file.id))
          );
          resolve(base64Images);
        } catch (error) {
          reject(error);
        }
      } else if (data.action === window.google.picker.Action.CANCEL) {
        resolve([]);
      }
    })
    .build();

  picker.setVisible(true);
};

/**
 * Download a file from Google Drive and convert it to base64.
 */
const downloadFile = async (fileId: string): Promise<string> => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to download file from Google Drive');
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Add types for window
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
