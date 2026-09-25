import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CustomFilter, WatchStatus } from '../types';
import { Plus, Trash2 } from 'lucide-react';

export default function CustomFilterManager({ onFilterSelect }: { onFilterSelect: (filter: CustomFilter) => void }) {
  const [filters, setFilters] = useState<CustomFilter[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<WatchStatus>('⏳ Watching');
  
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'custom_filters'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFilters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomFilter)));
    });
    return unsubscribe;
  }, []);

  const addFilter = async () => {
    if (!auth.currentUser || !name) return;
    await addDoc(collection(db, 'custom_filters'), {
        userId: auth.currentUser.uid,
        name,
        status,
    });
    setName('');
  };

  const removeFilter = async (id: string) => {
    await deleteDoc(doc(db, 'custom_filters', id));
  };

  return (
    <div className="p-4 bg-zinc-900 rounded-lg space-y-4 text-white">
      <h3 className="font-bold text-lg">Manage Filters</h3>
      <div className="flex gap-2">
        <input 
            className="flex-1 bg-zinc-800 text-white p-2 rounded border border-zinc-700"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New filter name"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as WatchStatus)} className="bg-zinc-800 p-2 rounded border border-zinc-700">
            <option value="✅ Watched">✅ Watched</option>
            <option value="⏳ Watching">⏳ Watching</option>
            <option value="⏸️ Paused">⏸️ Paused</option>
            <option value="❌ Dropped">❌ Dropped</option>
        </select>
        <button onClick={addFilter} className="bg-red-600 p-2 rounded"><Plus /></button>
      </div>
      <div className="space-y-2">
        {filters.map(filter => (
          <div key={filter.id} className="flex justify-between items-center bg-zinc-800 p-2 rounded">
            <button onClick={() => onFilterSelect(filter)}>{filter.name}</button>
            <button onClick={() => removeFilter(filter.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
