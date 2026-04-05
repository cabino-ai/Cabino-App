import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../lib/firebase';
import { base64ToBlob } from '../lib/imageUtils';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let message = error instanceof Error ? error.message : String(error);

  if (message.includes('storage/unknown')) {
    message = "Firebase Storage Error: This usually means you need to click 'Get Started' in the Firebase Storage Console to link your bucket. Please visit: https://console.firebase.google.com/project/gen-lang-client-0069291289/storage";
  }

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function uploadImage(base64: string, path: string): Promise<string> {
  try {
    const blob = base64ToBlob(base64, 'image/jpeg');
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  } catch (error) {
    console.error(`Storage Upload Error at ${path}:`, error);
    throw error;
  }
}

export interface Project {
  id?: string;
  uid: string;
  roomImage: string;
  cabinetImages: string[];
  generatedPrompt: string;
  generatedImage: string | null;
  extendToCeiling: boolean;
  stageRoom: boolean;
  masterPrompt?: string;
  isPublic?: boolean;
  createdAt: any;
}

export const saveProject = async (projectData: Omit<Project, 'id' | 'uid' | 'createdAt'>) => {
  if (!auth.currentUser) throw new Error("User must be authenticated to save projects");

  const { cabinetImages, roomImage, generatedImage, ...rest } = projectData;
  const path = 'projects';
  try {
    const docRef = doc(collection(db, path));
    const projectId = docRef.id;

    // Upload all images to Storage in parallel
    const [roomImageUrl, generatedImageUrl, ...cabinetImageUrls] = await Promise.all([
      uploadImage(roomImage, `projects/${projectId}/room.jpg`),
      generatedImage
        ? uploadImage(generatedImage, `projects/${projectId}/result.jpg`)
        : Promise.resolve(null),
      ...cabinetImages.map((img, index) =>
        uploadImage(img, `projects/${projectId}/cabinets/cabinet_${index}.jpg`)
      ),
    ]);

    await setDoc(docRef, {
      ...rest,
      roomImage: roomImageUrl,
      generatedImage: generatedImageUrl,
      cabinetImages: cabinetImageUrls,
      uid: auth.currentUser.uid,
      isPublic: false,
      createdAt: serverTimestamp(),
    });

    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getProjects = async (): Promise<Project[]> => {
  if (!auth.currentUser) return [];

  const path = 'projects';
  try {
    const q = query(
      collection(db, path),
      where("uid", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        cabinetImages: data.cabinetImages || [],
      } as Project;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const deleteProject = async (projectId: string) => {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getProjectById = async (projectId: string): Promise<Project | null> => {
  const path = `projects/${projectId}`;
  try {
    const docRef = doc(db, 'projects', projectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      cabinetImages: data.cabinetImages || [],
    } as Project;
  } catch (error) {
    console.error('Error in getProjectById:', error);
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const updateProjectSharing = async (projectId: string, isPublic: boolean) => {
  const path = `projects/${projectId}`;
  try {
    await setDoc(doc(db, 'projects', projectId), { isPublic }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};
