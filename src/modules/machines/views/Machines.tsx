import { useEffect, useState } from 'react';
import { Wrench, Plus, Trash2, Edit2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface Machine {
  id: string;
  name: string;
  code: string;
  serialNumber: string;
  category: string;
  department: string;
  location?: string;
  status: string;
  estimatedOutputPerHour?: number;
  createdAt: string;
}

export default function Machines({ searchQuery = '' }: { searchQuery?: string }) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    code: '',
    serialNumber: '',
    category: 'OTHER',
    department: '',
    location: '',
    status: 'ACTIVE',
    estimatedOutputPerHour: '',
  });

  const loadMachines = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/machines', {
        params: {
          search: searchQuery,
          take: 100,
        },
      });
      setMachines(res.data.machines);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load machines. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, [searchQuery]);

  const resetForm = () => {
    setForm({
      name: '',
      code: '',
      serialNumber: '',
      category: 'OTHER',
      department: '',
      location: '',
      status: 'ACTIVE',
      estimatedOutputPerHour: '',
    });
    setEditingMachine(null);
  };

  const handleEditMachine = (machine: Machine) => {
    setForm({
      name: machine.name,
      code: machine.code,
      serialNumber: machine.serialNumber,
      category: machine.category,
      department: machine.department,
      location: machine.location || '',
      status: machine.status,
      estimatedOutputPerHour: machine.estimatedOutputPerHour?.toString() || '',
    });
    setEditingMachine(machine);
    setShowForm(true);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.serialNumber || !form.department) {
      setError('Name, code, serial number, and department are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMachine) {
        // Update
        await axiosClient.patch(`/machines/${editingMachine.id}`, {
          name: form.name,
          status: form.status,
          location: form.location,
          estimatedOutputPerHour: form.estimatedOutputPerHour ? Number(form.estimatedOutputPerHour) : undefined,
        });
      } else {
        // Create
        await axiosClient.post('/machines', {
          ...form,
          estimatedOutputPerHour: form.estimatedOutputPerHour ? Number(form.estimatedOutputPerHour) : undefined,
        });
      }
      resetForm();
      setShowForm(false);
      setError('');
      loadMachines();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save machine');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/machines/${deleteConfirmation.id}`);
      setDeleteConfirmation(null);
      loadMachines();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete machine');
    } finally {
      setIsDeleting(false);
    }
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    IDLE: 'bg-slate-50 text-slate-700 border-slate-200',
    UNDER_MAINTENANCE: 'bg-amber-50 text-amber-700 border-amber-200',
    OUT_OF_SERVICE: 'bg-rose-50 text-rose-700 border-rose-200',
    DECOMMISSIONED: 'bg-gray-50 text-gray-700 border-gray-200',
    DISPOSED: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  const categories = [
    'BOTTLING_LINE',
    'CARTONING_MACHINE',
    'DATE_CODER',
    'SCALE',
    'BLOWER',
    'FILLING_MACHINE',
    'CAPPING_MACHINE',
    'LABELING_MACHINE',
    'GRINDING_MACHINE',
    'MIXING_MACHINE',
    'PACKAGING_LINE',
    'OTHER',
  ];

  const statuses = ['ACTIVE', 'IDLE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'DECOMMISSIONED', 'DISPOSED'];

  const filteredMachines = machines.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Machines & Assets</h2>
          <p className="text-[#737373] text-xs">Master register of all machines, equipment, and assets.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-3d px-4 h-9"
        >
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add Machine
          </span>
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* Add/Edit Machine Modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <form onSubmit={handleSaveMachine} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <Wrench className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">{editingMachine ? 'Edit Machine' : 'Add Machine'}</h3>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Bottling Line A"
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g., BL-001"
                    disabled={!!editingMachine}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335] disabled:bg-slate-50"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Serial Number *</label>
                  <input
                    type="text"
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    placeholder="e.g., SN12345"
                    disabled={!!editingMachine}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335] disabled:bg-slate-50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    disabled={!!editingMachine}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335] disabled:bg-slate-50"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department *</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    disabled={!!editingMachine}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335] disabled:bg-slate-50"
                  >
                    <option value="">Select department</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Grinding">Grinding</option>
                    <option value="Quality">Quality</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g., Building A, Floor 2"
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Output/Hour</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.estimatedOutputPerHour}
                  onChange={(e) => setForm({ ...form, estimatedOutputPerHour: e.target.value })}
                  placeholder="e.g., 1000"
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{isSaving ? 'Saving...' : editingMachine ? 'Update Machine' : 'Add Machine'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Machines List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl p-4 flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-48" />
              </div>
              <Skeleton className="h-6 w-24 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {filteredMachines.length === 0 ? (
            <EmptyState title="No machines yet." />
          ) : (
            filteredMachines.map((machine) => (
              <div key={machine.id} className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-xs font-bold text-[#171717]">{machine.code}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColors[machine.status] || 'bg-slate-50'}`}>
                      {machine.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {machine.name} · {machine.category.replace(/_/g, ' ')} · {machine.department}
                  </p>
                  {machine.location && <p className="text-[10px] text-slate-500">📍 {machine.location}</p>}
                  {machine.serialNumber && <p className="text-[10px] text-slate-500">SN: {machine.serialNumber}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditMachine(machine)}
                    className="h-8 px-3 rounded-lg border border-blue-200 text-blue-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-blue-50"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmation({ id: machine.id, name: machine.name })}
                    className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Machine"
          description={`Machine "${deleteConfirmation.name}" will be decommissioned. This action cannot be undone.`}
          onConfirm={handleDeleteMachine}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
