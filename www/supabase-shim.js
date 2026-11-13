/* LAAGANAN - Supabase adapter
   Gives the app the same three services it used inside claude.ai:
   claude.use('db'), claude.use('user'), claude.use('assets')           */

const SUPABASE_URL = "https://wcgyrwufzxjewoumgxqn.supabase.co/rest/v1/";          // e.g. https://abcdxyz.supabase.co
const SUPABASE_ANON_KEY = "https://wcgyrwufzxjewoumgxqn.supabase.co/rest/v1/"; // the public "anon" / "publishable" key

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Anonymous sign-in: one user ID per device/browser, kept in local storage.
const _ready = (async () => {
  try {
    const { data } = await _sb.auth.getSession();
    if (!data.session) {
      const r = await _sb.auth.signInAnonymously();
      if (r.error) console.error('Sign-in failed', r.error);
    }
    const u = (await _sb.auth.getUser()).data.user;
    if (location.search.includes('whoami') && u) alert('Your user ID:\n' + u.id);
  } catch (e) { console.error(e); }
})();

const _split = p => { const i = p.indexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };
const _snap = row => ({ exists: !!row, data: () => (row ? row.data : undefined) });
const _chan = () => 'ch_' + Math.random().toString(36).slice(2);

function _col(name) {
  return {
    async _fetch() {
      await _ready;
      const { data, error } = await _sb.from('docs').select('id,data').eq('collection', name);
      if (error) throw error;
      return { docs: (data || []).map(r => ({ id: r.id, data: () => r.data })) };
    },
    onSnapshot(cb, err) {
      let on = true;
      const run = async () => { try { const s = await this._fetch(); if (on) cb(s); } catch (e) { if (err) err(e); } };
      run();
      const ch = _sb.channel(_chan())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'collection=eq.' + name }, run)
        .subscribe();
      return () => { on = false; _sb.removeChannel(ch); };
    },
    async add(obj) {
      await _ready;
      const id = crypto.randomUUID();
      const { error } = await _sb.from('docs').insert({ collection: name, id, data: obj });
      if (error) throw error;
      return { id };
    }
  };
}

function _doc(path) {
  const [c, id] = _split(path);
  return {
    async get() {
      await _ready;
      const { data, error } = await _sb.from('docs').select('data').eq('collection', c).eq('id', id).maybeSingle();
      if (error) throw error;
      return _snap(data);
    },
    onSnapshot(cb, err) {
      let on = true;
      const run = async () => { try { const s = await this.get(); if (on) cb(s); } catch (e) { if (err) err(e); } };
      run();
      const ch = _sb.channel(_chan())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'id=eq.' + id }, run)
        .subscribe();
      return () => { on = false; _sb.removeChannel(ch); };
    },
    async set(obj) {
      await _ready;
      const { error } = await _sb.from('docs').upsert(
        { collection: c, id, data: obj, updated_at: new Date().toISOString() },
        { onConflict: 'collection,id' });
      if (error) throw error;
    },
    async update(patch) {
      await _ready;
      const { error } = await _sb.rpc('doc_update', { p_collection: c, p_id: id, p_patch: patch });
      if (error) throw error;
    },
    async delete() {
      await _ready;
      const { error } = await _sb.from('docs').delete().eq('collection', c).eq('id', id);
      if (error) throw error;
    }
  };
}

const _db = { collection: _col, doc: _doc };
const _user = {
  id: async () => { await _ready; const u = (await _sb.auth.getUser()).data.user; return u ? u.id : null; },
  isOwner: async () => { await _ready; const r = await _sb.rpc('is_admin'); return r.data === true; }
};
const _assets = {
  upload: async (file) => {
    await _ready;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await _sb.storage.from('uploads').upload(id, file, { contentType: file.type || 'image/jpeg' });
    if (error) throw error;
    return { id, url: bu(id) };
  }
};

window.claude = { use: async (name) => ({ db: _db, user: _user, assets: _assets }[name] || null) };
// Public image address for a stored file id.
window.bu = id => SUPABASE_URL + '/storage/v1/object/public/uploads/' + id;
