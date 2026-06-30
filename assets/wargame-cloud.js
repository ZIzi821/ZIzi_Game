(function (global) {
  "use strict";

  const COLLECTION = "wargameItems";
  const SCHEMA_VERSION = 1;
  const TYPES = Object.freeze(["map", "unit", "scenario"]);
  const VISIBILITIES = Object.freeze(["private", "unlisted", "public"]);
  let cloudPromise;

  function cleanText(value, fallback, max) {
    const text = String(value == null ? "" : value).trim() || fallback;
    return text.slice(0, max);
  }

  function normalizeItem(item) {
    if (!item || typeof item !== "object") throw new Error("Cloud item must be an object");
    if (!TYPES.includes(item.type)) throw new Error("Invalid cloud item type");
    const visibility = VISIBILITIES.includes(item.visibility) ? item.visibility : "private";
    return {
      schemaVersion: SCHEMA_VERSION,
      type: item.type,
      title: cleanText(item.title, "Untitled", 80),
      description: cleanText(item.description, "", 500),
      visibility,
      payload: item.payload && typeof item.payload === "object" ? item.payload : {},
    };
  }

  async function initWargameCloud() {
    if (!cloudPromise) {
      cloudPromise = Promise.all([
        import("./firebase-config.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
      ]).then(async ([configModule, appModule, authModule, firestoreModule]) => {
        const app = appModule.getApps().length
          ? appModule.getApp()
          : appModule.initializeApp(configModule.firebaseConfig);
        const auth = authModule.getAuth(app);
        if (!auth.currentUser) await authModule.signInAnonymously(auth);
        const db = firestoreModule.getFirestore(app);
        return { auth, db, fs: firestoreModule };
      }).catch((error) => {
        cloudPromise = undefined;
        throw error;
      });
    }
    return cloudPromise;
  }

  async function saveCloudItem(item) {
    const cloud = await initWargameCloud();
    const normalized = normalizeItem(item);
    const now = cloud.fs.serverTimestamp();
    const ref = await cloud.fs.addDoc(cloud.fs.collection(cloud.db, COLLECTION), {
      ...normalized,
      ownerUid: cloud.auth.currentUser.uid,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  }

  async function updateCloudItem(id, item) {
    const cloud = await initWargameCloud();
    const normalized = normalizeItem(item);
    await cloud.fs.updateDoc(cloud.fs.doc(cloud.db, COLLECTION, id), {
      ...normalized,
      updatedAt: cloud.fs.serverTimestamp(),
    });
    return id;
  }

  async function deleteCloudItem(id) {
    const cloud = await initWargameCloud();
    await cloud.fs.deleteDoc(cloud.fs.doc(cloud.db, COLLECTION, id));
  }

  async function getCloudItem(id) {
    const cloud = await initWargameCloud();
    const snapshot = await cloud.fs.getDoc(cloud.fs.doc(cloud.db, COLLECTION, id));
    if (!snapshot.exists()) throw new Error("Cloud item not found");
    return { id: snapshot.id, ...snapshot.data() };
  }

  async function listMyCloudItems(type) {
    const cloud = await initWargameCloud();
    const constraints = [
      cloud.fs.where("ownerUid", "==", cloud.auth.currentUser.uid),
      cloud.fs.limit(25),
    ];
    if (type) constraints.unshift(cloud.fs.where("type", "==", type));
    const snapshot = await cloud.fs.getDocs(cloud.fs.query(cloud.fs.collection(cloud.db, COLLECTION), ...constraints));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function listPublicCloudItems(type) {
    const cloud = await initWargameCloud();
    const constraints = [
      cloud.fs.where("visibility", "==", "public"),
      cloud.fs.limit(25),
    ];
    if (type) constraints.unshift(cloud.fs.where("type", "==", type));
    const snapshot = await cloud.fs.getDocs(cloud.fs.query(cloud.fs.collection(cloud.db, COLLECTION), ...constraints));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  global.ZiziWargameCloud = Object.freeze({
    initWargameCloud,
    saveCloudItem,
    updateCloudItem,
    deleteCloudItem,
    getCloudItem,
    listMyCloudItems,
    listPublicCloudItems,
  });
})(typeof window !== "undefined" ? window : globalThis);
