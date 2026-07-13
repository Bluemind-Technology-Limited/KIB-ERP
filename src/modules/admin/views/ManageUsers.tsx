import { useState } from 'react';
import { Users, Plus, Shield, Check, Copy, X } from 'lucide-react';

interface ManageUsersProps {
  searchQuery?: string;
}

export default function ManageUsers({ searchQuery = '' }: ManageUsersProps) {
  const [users, setUsers] = useState([
    { id: '1', name: 'Alex Johnson', email: 'admin@kib.group', role: 'SUPER_ADMIN', status: 'ACTIVE', tempPass: '••••••••' },
    { id: '2', name: 'Sarah Connor', email: 'production@kib.group', role: 'PRODUCTION_MANAGER', status: 'ACTIVE', tempPass: '••••••••' },
    { id: '3', name: 'Marcus Miller', email: 'sales@kib.group', role: 'SALES_REP', status: 'ACTIVE', tempPass: '••••••••' },
    { id: '4', name: 'John Doe', email: 'farms@kib.group', role: 'FARM_MANAGER', status: 'ACTIVE', tempPass: '••••••••' },
  ]);

  const filteredUsers = users.filter((u) => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', role: 'SALES_REP', tempPass: '' });

  // Generate a random temporary password
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'KIB-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleOpenModal = () => {
    setNewUser({
      firstName: '',
      lastName: '',
      email: '',
      role: 'SALES_REP',
      tempPass: generateTempPassword()
    });
    setIsModalOpen(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newUser.tempPass);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1500);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.firstName || !newUser.lastName || !newUser.email) return;

    setUsers([
      ...users,
      {
        id: crypto.randomUUID(),
        name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: newUser.role,
        status: 'ACTIVE',
        tempPass: newUser.tempPass,
      }
    ]);

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-[#171717]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#171717]">User Accounts Management</h2>
          <p className="text-xs text-[#737373]">Provision new dashboard accounts, manage role policies and view generated credentials.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="btn-3d h-9 px-4 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Provision User</span>
        </button>
      </div>

      <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
        <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-[#EA4335]" />
          Dashboard Operators Directory
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                <th className="py-3.5 px-4 font-semibold">Full Name</th>
                <th className="py-3.5 px-3 font-semibold">Email Address</th>
                <th className="py-3.5 px-3 font-semibold">System Access Role</th>
                <th className="py-3.5 px-3 font-semibold">Temporary Password</th>
                <th className="py-3.5 px-4 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E9E9]">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-semibold text-[#313131]">{u.name}</td>
                  <td className="py-4 px-3 text-[#737373] font-medium">{u.email}</td>
                  <td className="py-4 px-3">
                    <span className="inline-flex items-center gap-1 text-[9px] bg-slate-100 text-[#171717] px-2 py-0.5 rounded font-bold border border-slate-200">
                      <Shield className="w-2.5 h-2.5 opacity-60" />
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-[#737373] font-mono text-[11px]">{u.tempPass}</td>
                  <td className="py-4 px-4 text-right">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-650 border border-emerald-500/20">
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E9E9E9] rounded-lg w-full max-w-md p-6 relative flex flex-col gap-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#EA4335]" />
              Provision New User
            </h3>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Isaac"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Wayne"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@kib.group"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Access Role Policy</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="PRODUCTION_MANAGER">Production Manager</option>
                  <option value="SALES_REP">Sales Representative</option>
                  <option value="FARM_MANAGER">Farm Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Auto-Generated Temporary Password</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUser.tempPass}
                    readOnly
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-650 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="h-[34px] px-3 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer bg-white"
                    title="Copy Password"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Copy and provide this password to the user. They can update it in their profile settings page.</p>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full h-[40px] btn-3d flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Provision Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
