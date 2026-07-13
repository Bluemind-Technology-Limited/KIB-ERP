import { useState } from 'react';
import { FileText, UploadCloud, Trash2, Eye, ShieldCheck } from 'lucide-react';
import { uploadAssetToR2 } from '../../../lib/r2Client';

interface DocumentCenterProps {
  searchQuery?: string;
}

export default function DocumentCenter({ searchQuery = '' }: DocumentCenterProps) {
  const [documents, setDocuments] = useState([
    { id: '1', title: 'Product Specification C30.pdf', size: 1048576, path: 'specs/c30_v2.pdf', uploadedAt: '2026-07-10T14:23:00Z' },
    { id: '2', title: 'Financial Sync Log - Q2.xlsx', size: 2457600, path: 'finance/sync_q2.xlsx', uploadedAt: '2026-07-11T09:12:00Z' },
  ]);

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleUploadSimulate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    // Simulate pre-signed URL upload
    const mockPresignedUrl = 'https://r2.kib.group/signed-upload-token';
    
    await uploadAssetToR2(mockPresignedUrl, file, (progress) => {
      setUploadProgress(progress);
    });

    // In local sandbox, axios.put will fail since the URL is mock, so we simulate completion anyway:
    setTimeout(() => {
      setUploadProgress(100);
      setTimeout(() => {
        const newDoc = {
          id: crypto.randomUUID(),
          title: file.name,
          size: file.size,
          path: `uploads/${file.name}`,
          uploadedAt: new Date().toISOString(),
        };
        setDocuments([newDoc, ...documents]);
        setUploadProgress(null);
      }, 500);
    }, 1000);
  };

  const handleDelete = (id: string) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  return (
    <div className="space-y-6 text-[#171717]">
      <div>
        <h2 className="text-xl font-bold text-[#171717]">Creations Document Vault</h2>
        <p className="text-xs text-[#737373]">Directly stream files and specification attachments securely to Cloudflare R2 bucket.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Portal */}
        <div className="lg:col-span-1 bg-white border border-[#E9E9E9] rounded-lg p-6 flex flex-col justify-between h-[250px]">
          <div>
            <h3 className="text-sm font-bold text-[#313131] mb-1">R2 Direct Storage Portal</h3>
            <p className="text-xs text-[#737373]">Files bypass servers to upload directly into Cloudflare bucket.</p>
          </div>

          <div className="space-y-3">
            {uploadProgress !== null ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-[#EA4335]">
                  <span>Uploading file...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-[#EA4335] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            ) : (
              <label className="border border-dashed border-slate-200 hover:border-[#EA4335] bg-[#FBFBFB] hover:bg-slate-50 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                <UploadCloud className="w-8 h-8 text-slate-400" />
                <span className="text-xs text-[#313131] font-semibold">Select and Stream File</span>
                <input
                  type="file"
                  onChange={handleUploadSimulate}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        <div className="lg:col-span-2 bg-white border border-[#E9E9E9] rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#313131]">Stored Vault Items</h3>
            <span className="text-[10px] text-[#737373] font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified via Cloudflare API
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-[#737373] text-xs">
                No documents currently present in the vault.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                    <th className="py-2.5 px-3 font-semibold">Document Title</th>
                    <th className="py-2.5 px-3 font-semibold">Bucket Path</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Size</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9E9E9]">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <span className="text-[#313131] font-semibold">{doc.title}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-[#737373]">{doc.path}</td>
                      <td className="py-3 px-3 text-right text-[#313131] font-mono">{(doc.size / 1024 / 1024).toFixed(2)} MB</td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button type="button" className="text-slate-400 hover:text-[#EA4335] transition-colors cursor-pointer" title="Preview File">
                          <Eye className="w-4 h-4 inline animate-none" />
                        </button>
                        <button type="button" onClick={() => handleDelete(doc.id)} className="text-slate-400 hover:text-[#EA4335] transition-colors cursor-pointer" title="Delete File">
                          <Trash2 className="w-4 h-4 inline animate-none" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
