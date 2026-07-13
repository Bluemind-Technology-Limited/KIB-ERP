import { useState } from 'react';
import { Layers, Plus, Tag, X } from 'lucide-react';

interface RecipeIngredientsProps {
  searchQuery?: string;
}

export default function RecipeIngredients({ searchQuery = '' }: RecipeIngredientsProps) {
  const [ingredients, setIngredients] = useState([
    { id: '1', name: 'Turmeric Powder', category: 'Base Spice', cost: 120, unit: 'ton' },
    { id: '2', name: 'Spanish Paprika', category: 'Color Enhancer', cost: 35, unit: 'ton' },
    { id: '3', name: 'Ground Cumin', category: 'Aromatic Herb', cost: 45, unit: 'ton' },
    { id: '4', name: 'Cardamom Extract', category: 'Pungent Agent', cost: 250, unit: 'liter' },
  ]);

  const filteredIngredients = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ing.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ name: '', category: 'Base Spice', cost: '', unit: 'ton' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredient.name || !newIngredient.cost) return;

    setIngredients([
      ...ingredients,
      {
        id: crypto.randomUUID(),
        name: newIngredient.name,
        category: newIngredient.category,
        cost: parseFloat(newIngredient.cost),
        unit: newIngredient.unit,
      },
    ]);

    setNewIngredient({ name: '', category: 'Base Spice', cost: '', unit: 'ton' });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-[#171717]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#171717]">Recipe Ingredients Registry</h2>
          <p className="text-xs text-[#737373]">Configure ingredient catalog definitions and base material costing metrics.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-3d h-9 px-4 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Add Material</span>
        </button>
      </div>

      <div className="flex flex-col gap-6 w-full">
        
        {/* Row 1: Ingredient list */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#313131] mb-4">Base Materials Catalog</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                  <th className="py-3.5 px-4 font-semibold">Material Name</th>
                  <th className="py-3.5 px-3 font-semibold">Category</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Standard Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E9]">
                {filteredIngredients.map((ing) => (
                  <tr key={ing.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 flex items-center gap-2.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-[#313131] font-semibold">{ing.name}</span>
                    </td>
                    <td className="py-4 px-3 text-[#737373]">{ing.category}</td>
                    <td className="py-4 px-4 text-right text-[#313131] font-mono">${ing.cost} per {ing.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E9E9E9] rounded-lg w-full max-w-md p-6 relative">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#EA4335]" />
              Add Material Class
            </h3>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Silica Fume"
                  value={newIngredient.name}
                  onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Category</label>
                <select
                  value={newIngredient.category}
                  onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="Base Spice">Base Spice</option>
                  <option value="Aromatic Herb">Aromatic Herb</option>
                  <option value="Pungent Agent">Pungent Agent</option>
                  <option value="Color Enhancer">Color Enhancer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Cost ($)</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={newIngredient.cost}
                    onChange={(e) => setNewIngredient({ ...newIngredient, cost: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Unit</label>
                  <select
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  >
                    <option value="ton">ton</option>
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="bag">bag</option>
                    <option value="units">units</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full h-[40px] btn-3d flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Register Material</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
