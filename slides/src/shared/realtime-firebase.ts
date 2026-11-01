import { GithubAuthProvider, getAuth, linkWithPopup, signInAnonymously, signInWithCredential } from 'firebase/auth';
import { Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { PRESENTER_GITHUB_ID, SESSION_ID } from './config';
import { getFirebaseApp } from './firebase';
import { nameKey } from './names';
import { QUESTION_IDS, type AnswerKey } from './questions';
import { emptySlide, type AudienceQuestion, type ChasquiData, type Player, type Reaction, type Realtime, type SlideState, type VoteRecord, type Votes } from './realtime';

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : undefined);

export async function createFirebaseRealtime(): Promise<Realtime> {
  const app = await getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Todo el público entra anónimo: sin formularios, sin datos personales.
  // Primero esperamos a que Firebase restaure la sesión: si ya es la presentadora (GitHub),
  // NO entramos anónimo (eso reemplazaría su sesión y las reglas dejarían de reconocerla).
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);

  const session = doc(db, 'sessions', SESSION_ID);
  const sub = (name: string) => collection(session, name);
  const uid = () => auth.currentUser!.uid;

  return {
    mode: 'firebase',
    uid,

    async patchSlide(s) {
      await setDoc(session, { ...s, updatedAt: serverTimestamp() }, { merge: true });
    },
    async openQuestion(q) {
      // Hora del SERVIDOR: la misma base que los timestamps de los votos → puntaje justo.
      await setDoc(session, { openedAt: { [q]: serverTimestamp() } }, { merge: true });
    },
    async markEarlyEnd() {
      const cur = (await getDoc(session)).data();
      if (!cur?.earlyUntil) await setDoc(session, { earlyUntil: serverTimestamp() }, { merge: true });
    },
    onSlide(cb) {
      return onSnapshot(session, (snap) => {
        const data = (snap.data({ serverTimestamps: 'estimate' }) ?? {}) as Record<string, unknown>;
        const openedAt: SlideState['openedAt'] = {};
        const raw = (data.openedAt ?? {}) as Record<string, unknown>;
        for (const q of QUESTION_IDS) if (raw[q]) openedAt[q] = ms(raw[q]);
        cb({ ...emptySlide(), ...(data as Partial<SlideState>), openedAt, earlyUntil: ms(data.earlyUntil) ?? null });
      });
    },

    async reserveName(name) {
      const ref = doc(sub('names'), nameKey(name));
      const owner = async () => (await getDoc(ref)).data()?.uid as string | undefined;
      const current = await owner();
      if (current) return current === uid();
      try {
        // Las reglas solo permiten CREAR (nunca sobrescribir): el primero gana.
        await setDoc(ref, { uid: uid(), at: serverTimestamp() });
        return true;
      } catch {
        return (await owner()) === uid();
      }
    },
    async takenNames(names) {
      const snaps = await Promise.all(names.map((n) => getDoc(doc(sub('names'), nameKey(n)))));
      return new Set(names.filter((_, i) => snaps[i].exists() && snaps[i].data()?.uid !== uid()));
    },
    async join(name) {
      // La hora de entrada se fija UNA vez (las reglas no dejan cambiarla): recargar no te quita el bono.
      const ref = doc(sub('players'), uid());
      const prev = await getDoc(ref);
      if (prev.exists()) await updateDoc(ref, { name });
      else await setDoc(ref, { name, at: serverTimestamp() });
    },
    async vote(q, option) {
      await setDoc(doc(sub('votes'), uid()), { [q]: option, [`${q}At`]: serverTimestamp() }, { merge: true });
    },
    onMyVotes(cb) {
      return onSnapshot(doc(sub('votes'), uid()), (snap) => {
        const d = snap.data() ?? {};
        const votes: Votes = {};
        for (const q of QUESTION_IDS) if (d[q]) votes[q] = d[q];
        cb(votes);
      });
    },
    async react(r) {
      await setDoc(doc(sub('reactions'), uid()), { r, n: Math.floor(Math.random() * 1e9), at: serverTimestamp() });
    },
    async ask(q) {
      await addDoc(sub('questions'), { ...q, uid: uid(), at: serverTimestamp() });
    },
    async publishChasqui(d) {
      const ref = doc(sub('chasquis'), uid());
      const prev = await getDoc(ref);
      if (prev.exists()) await updateDoc(ref, { name: d.name, encargo: d.encargo, opts: d.opts });
      else await setDoc(ref, { ...d, createdAt: serverTimestamp(), hidden: false });
    },

    onPlayers(cb) {
      return onSnapshot(sub('players'), (snap) => cb(snap.docs.map((d): Player => ({ id: d.id, name: d.data().name, at: ms(d.data({ serverTimestamps: 'estimate' }).at) }))));
    },
    onVotes(cb) {
      return onSnapshot(sub('votes'), (snap) =>
        cb(
          snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' });
            const rec: VoteRecord = { uid: d.id, votes: {}, at: {} };
            for (const q of QUESTION_IDS) {
              if (data[q]) rec.votes[q] = data[q];
              if (data[`${q}At`]) rec.at[q] = ms(data[`${q}At`]);
            }
            return rec;
          }),
        ),
      );
    },
    onReaction(cb) {
      let first = true;
      return onSnapshot(sub('reactions'), (snap) => {
        if (first) {
          first = false; // ignoramos el estado inicial: solo reacciones nuevas
          return;
        }
        for (const change of snap.docChanges()) if (change.type !== 'removed') cb(change.doc.data().r as Reaction, change.doc.id);
      });
    },
    onChasquis(cb) {
      const q = query(sub('chasquis'), orderBy('createdAt', 'desc'), limit(400));
      return onSnapshot(q, (snap) =>
        cb(
          snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' });
            return { ...(data as ChasquiData), id: d.id, createdAt: ms(data.createdAt) ?? Date.now() };
          }),
        ),
      );
    },
    onQuestions(cb, onError) {
      // Si el listener falla (permiso, red), Firestore lo cierra: lo reabrimos solos.
      let off: (() => void) | null = null;
      let timer = 0;
      let stopped = false;
      const listen = () => {
        off = onSnapshot(
          query(sub('questions'), orderBy('at', 'asc'), limit(150)),
          (snap) =>
            cb(
              snap.docs.map((d) => {
                const data = d.data({ serverTimestamps: 'estimate' });
                return { ...(data as AudienceQuestion), id: d.id, at: ms(data.at) ?? Date.now() };
              }),
            ),
          (err) => {
            onError?.(err.code === 'permission-denied' ? 'Sin permiso para leer preguntas: inicia sesión con GitHub (Presentar en vivo).' : `No pude leer las preguntas (${err.code}). Reintentando…`);
            if (!stopped) timer = window.setTimeout(listen, 4000);
          },
        );
      };
      listen();
      return () => {
        stopped = true;
        clearTimeout(timer);
        off?.();
      };
    },
    async removeQuestion(id) {
      await deleteDoc(doc(sub('questions'), id));
    },
    async setChasquiHidden(id, hidden) {
      await updateDoc(doc(sub('chasquis'), id), { hidden });
    },
    async resetSession() {
      let n = 0;
      for (const name of ['players', 'names', 'votes', 'reactions', 'questions', 'chasquis']) {
        const snap = await getDocs(sub(name));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        n += snap.size;
      }
      await setDoc(session, { ...emptySlide(), updatedAt: serverTimestamp() });
      return n;
    },

    async loadAnswers() {
      // Las reglas solo permiten leer este documento a la presentadora.
      const snap = await getDoc(doc(session, 'private', 'answers'));
      return snap.exists() ? (snap.data() as AnswerKey) : null;
    },
    async saveAnswers(a) {
      await setDoc(doc(session, 'private', 'answers'), a);
    },

    async signInPresenter() {
      const provider = new GithubAuthProvider();
      const current = auth.currentUser;
      if (current?.providerData.some((p) => p.providerId === 'github.com')) {
        return current.providerData.some((p) => p.providerId === 'github.com' && p.uid === PRESENTER_GITHUB_ID);
      }
      try {
        if (current) await linkWithPopup(current, provider);
      } catch (err) {
        // Esa cuenta de GitHub ya estaba vinculada a otro uid: entramos con ella.
        const cred = GithubAuthProvider.credentialFromError(err as never);
        if (!cred) throw err;
        await signInWithCredential(auth, cred);
      }
      await auth.currentUser?.getIdToken(true);
      return true;
    },
    isPresenterSession: () => Boolean(auth.currentUser?.providerData.some((p) => p.providerId === 'github.com' && p.uid === PRESENTER_GITHUB_ID)),
  };
}
