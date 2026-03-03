/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Pencil,
  ChevronRight, 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  HardHat, 
  Hammer, 
  Package, 
  Layers,
  LayoutDashboard,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";
import { Project, Expense, ExpenseCategory, CATEGORY_LABELS, OwnerPayment } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981'];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function NumericInput({ 
  value, 
  onChange, 
  className, 
  placeholder,
  required 
}: { 
  value: number | null | undefined; 
  onChange: (val: number) => void; 
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const safeValue = value ?? 0;
  const [displayValue, setDisplayValue] = useState(safeValue === 0 ? '' : safeValue.toLocaleString('vi-VN'));

  useEffect(() => {
    // Update display value if external value changes (e.g. after form reset)
    const currentSafeValue = value ?? 0;
    const formatted = currentSafeValue === 0 ? '' : currentSafeValue.toLocaleString('vi-VN');
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numValue = rawValue === '' ? 0 : parseInt(rawValue, 10);
    setDisplayValue(rawValue === '' ? '' : numValue.toLocaleString('vi-VN'));
    onChange(numValue);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
}

export default function App() {
const getProjects = () => {
  const data = localStorage.getItem("projects");
  return data ? JSON.parse(data) : [];
};

const saveProjects = (projects: any[]) => {
  localStorage.setItem("projects", JSON.stringify(projects));
};
  const updateProjectInStorage = (updatedProject: Project) => {
  const projects = getProjects();

  const updatedProjects = projects.map(p =>
    p.id === updatedProject.id ? updatedProject : p
  );

  saveProjects(updatedProjects);
  setProjects(updatedProjects);
  setSelectedProject(updatedProject);
};

const getCurrentProject = () => {
  const projects = getProjects();
  return projects.find(p => p.id === selectedProjectId);
};
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showAddExpensePayment, setShowAddExpensePayment] = useState(false);
  const [showAddOwnerPayment, setShowAddOwnerPayment] = useState(false);
  const [showEditOwnerPayment, setShowEditOwnerPayment] = useState(false);
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'labor' | 'materials' | 'others' | 'photos'>('overview');
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Form states
  const [newProject, setNewProject] = useState({ name: '', budget: 0, start_date: format(new Date(), 'yyyy-MM-dd'), image_url: '' });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingOwnerPayment, setEditingOwnerPayment] = useState<OwnerPayment | null>(null);
  const [newExpense, setNewExpense] = useState({ 
    category: ExpenseCategory.LABOR, 
    description: '', 
    amount: 0, 
    quantity: 0,
    unit: '',
    date: format(new Date(), 'yyyy-MM-dd') 
  });
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const [newExpensePayment, setNewExpensePayment] = useState({ amount: 0, note: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [newOwnerPayment, setNewOwnerPayment] = useState({ amount: 0, note: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [newPhoto, setNewPhoto] = useState({ image_url: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetails(selectedProjectId);
      setActiveTab('overview');
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { text: "Extract expense details from this receipt/invoice image. Return ONLY a JSON object with these fields: description (string), amount (number), category (string, must be one of: 'labor', 'contracted_labor', 'raw_material', 'finishing_material', 'other'), date (string, YYYY-MM-DD). If you see 'xi mang', 'cat', 'da', 'gach xay' use 'raw_material'. If you see 'son', 'gach men', 'thiet bi ve sinh', 'cua' use 'finishing_material'. If you see 'luong', 'cong', 'nhan cong' use 'labor' or 'contracted_labor'. Otherwise use 'other'." },
                { inlineData: { mimeType: file.type, data: base64Data } }
              ]
            }
          ],
          config: { responseMimeType: "application/json" }
        });

        const result = JSON.parse(response.text || '{}');
        if (result.description || result.amount) {
          setNewExpense({
            category: result.category || ExpenseCategory.LABOR,
            description: result.description || '',
            amount: result.amount || 0,
            date: result.date || format(new Date(), 'yyyy-MM-dd')
          });
          setShowAddExpense(true);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to process image', err);
      alert('Không thể nhận diện hình ảnh. Vui lòng thử lại hoặc nhập thủ công.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const fetchProjects = async () => {
  
      const data = getProjects();
      setProjects(data);
      setLoading(false);
  };

  const fetchProjectDetails = (id: number) => {
  const projects = getProjects();
  const project = projects.find(p => p.id === id);
  setSelectedProject(project || null);
};
     const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
       
  const projects = getProjects();
       
const newProjectWithId = {
  ...newProject,
  id: Date.now(),
  expenses: [],
  owner_payments: [],
  photos: []
};
const updatedProjects = [...projects, newProjectWithId];

  saveProjects(updatedProjects);
  setProjects(updatedProjects);

  setShowAddProject(false);
  setNewProject({
    name: '',
    budget: 0,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    image_url: ''
  });
    } catch (err) {
      console.error('Failed to edit project', err);
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPhoto),
      });
      if (res.ok) {
        setShowAddPhoto(false);
        setNewPhoto({ image_url: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
        fetchProjectDetails(selectedProjectId);
      }
    } catch (err) {
      console.error('Failed to add photo', err);
    }
  };

  const handleDeletePhoto = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ảnh này?')) return;
    try {
      const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProjectId) fetchProjectDetails(selectedProjectId);
      } else {
        const errorData = await res.json();
        alert('Lỗi: ' + (errorData.error || 'Không thể xóa ảnh'));
      }
    } catch (err) {
      console.error('Failed to delete photo', err);
      alert('Lỗi kết nối khi xóa ảnh');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newExpense, project_id: selectedProjectId }),
      });
      if (res.ok) {
        setShowAddExpense(false);
        setNewExpense({ 
          category: ExpenseCategory.LABOR, 
          description: '', 
          amount: 0, 
          quantity: 0,
          unit: '',
          date: format(new Date(), 'yyyy-MM-dd') 
        });
        fetchProjectDetails(selectedProjectId);
      }
    } catch (err) {
      console.error('Failed to add expense', err);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !selectedProjectId) return;
    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingExpense),
      });
      if (res.ok) {
        setShowEditExpense(false);
        setEditingExpense(null);
        fetchProjectDetails(selectedProjectId);
      }
    } catch (err) {
      console.error('Failed to update expense', err);
    }
  };

  const handleAddExpensePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseId || !selectedProjectId) return;
    try {
      const res = await fetch(`/api/expenses/${selectedExpenseId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExpensePayment),
      });
      if (res.ok) {
        setShowAddExpensePayment(false);
        setNewExpensePayment({ amount: 0, note: '', date: format(new Date(), 'yyyy-MM-dd') });
        fetchProjectDetails(selectedProjectId);
      }
    } catch (err) {
      console.error('Failed to add expense payment', err);
    }
  };

  const handleDeleteExpensePayment = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa đợt ứng này?')) return;
    try {
      const res = await fetch(`/api/expense-payments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProjectId) fetchProjectDetails(selectedProjectId);
      } else {
        const errorData = await res.json();
        alert('Lỗi: ' + (errorData.error || 'Không thể xóa đợt ứng'));
      }
    } catch (err) {
      console.error('Failed to delete expense payment', err);
      alert('Lỗi kết nối khi xóa đợt ứng');
    }
  };

  const handleAddOwnerPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/owner-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOwnerPayment),
      });
      if (res.ok) {
        setShowAddOwnerPayment(false);
        setNewOwnerPayment({ amount: 0, note: '', date: format(new Date(), 'yyyy-MM-dd') });
        fetchProjectDetails(selectedProjectId);
      }
    } catch (err) {
      console.error('Failed to add owner payment', err);
    }
  };

  const handleUpdateOwnerPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOwnerPayment || !selectedProjectId) return;
    try {
      const res = await fetch(`/api/owner-payments/${editingOwnerPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOwnerPayment),
      });
      if (res.ok) {
        setShowEditOwnerPayment(false);
        setEditingOwnerPayment(null);
        fetchProjectDetails(selectedProjectId);
      }
    } catch (err) {
      console.error('Failed to update owner payment', err);
    }
  };

  const handleDeleteOwnerPayment = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa đợt ứng này?')) return;
    try {
      const res = await fetch(`/api/owner-payments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProjectId) fetchProjectDetails(selectedProjectId);
      } else {
        const errorData = await res.json();
        alert('Lỗi: ' + (errorData.error || 'Không thể xóa đợt ứng'));
      }
    } catch (err) {
      console.error('Failed to delete owner payment', err);
      alert('Lỗi kết nối khi xóa đợt ứng');
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chi phí này?')) return;
    try {
      console.log(`Deleting expense ${id}`);
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProjectId) {
          fetchProjectDetails(selectedProjectId);
        }
      } else {
        const errorData = await res.json();
        alert('Lỗi: ' + (errorData.error || 'Không thể xóa chi phí'));
      }
    } catch (err) {
      console.error('Failed to delete expense', err);
      alert('Lỗi kết nối khi xóa chi phí');
    }
  };

  const handleDeleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ công trình này?')) return;
    try {
     const projects = getProjects();

const updatedProjects = projects.filter(
  (project) => project.id !== id
);

saveProjects(updatedProjects);

setProjects(updatedProjects);

if (selectedProjectId === id) {
  setSelectedProjectId(null);
}
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const stats = useMemo(() => {
    if (!selectedProject || !selectedProject.expenses) return null;
    
    const totals = selectedProject.expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      acc.total += exp.amount;
      return acc;
    }, { total: 0 } as Record<string, number>);

    const totalReceived = selectedProject.owner_payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

    const chartData = Object.values(ExpenseCategory).map(cat => ({
      name: CATEGORY_LABELS[cat],
      value: totals[cat] || 0
    }));

    const profit = selectedProject.budget - totals.total;
    const profitMargin = selectedProject.budget > 0 ? (profit / selectedProject.budget) * 100 : 0;
    const balanceWithOwner = totalReceived - totals.total;

    return { totals, chartData, profit, profitMargin, totalReceived, balanceWithOwner };
  }, [selectedProject]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <HardHat className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Xây Dựng Pro</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:inline">Quản lý công trình dân dụng</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedProjectId ? (
          /* Project List View */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Danh sách công trình</h2>
                <p className="text-slate-500">Theo dõi và quản lý các dự án đang thi công</p>
              </div>
              <button 
                onClick={() => setShowAddProject(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus size={20} />
                Thêm công trình
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <LayoutDashboard className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900">Chưa có công trình nào</h3>
                <p className="text-slate-500 mb-6">Bắt đầu bằng cách tạo công trình đầu tiên của bạn.</p>
                <button 
                  onClick={() => setShowAddProject(true)}
                  className="text-indigo-600 font-semibold hover:text-indigo-700"
                >
                  Tạo công trình ngay &rarr;
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-all cursor-pointer group relative"
                  >
                    <div className="h-40 bg-slate-100 relative overflow-hidden">
                      {project.image_url ? (
                        <img 
                          src={project.image_url} 
                          alt={project.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Hammer className="text-slate-300 w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setShowEditProject(true);
                          }}
                          className="bg-white/90 backdrop-blur p-2 rounded-lg text-slate-600 hover:text-indigo-600 transition-all shadow-sm"
                        >
                          <Layers size={16} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="bg-white/90 backdrop-blur p-2 rounded-lg text-slate-600 hover:text-red-500 transition-all shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{project.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                        <Calendar size={14} />
                        <span>Bắt đầu: {project.start_date}</span>
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Ngân sách</p>
                          <p className="text-indigo-600 font-bold">{formatCurrency(project.budget)}</p>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Project Detail View */
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button 
                onClick={() => setSelectedProjectId(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors w-fit"
              >
                <ArrowLeft size={20} />
                Quay lại danh sách
              </button>
              <div className="flex items-center gap-3">
                <label className={cn(
                  "bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm cursor-pointer hover:bg-slate-50",
                  isProcessingImage && "opacity-50 cursor-not-allowed"
                )}>
                  {isProcessingImage ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  ) : (
                    <Layers className="w-5 h-5" />
                  )}
                  {isProcessingImage ? 'Đang xử lý...' : 'Quét ảnh'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    onChange={handleImageUpload}
                    disabled={isProcessingImage}
                  />
                </label>
              </div>
            </div>

            {selectedProject && (
              <>
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm mb-8">
                  <div className="flex flex-col md:flex-row justify-between gap-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-3xl font-black text-slate-900">{selectedProject.name}</h2>
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                          Đang thi công
                        </span>
                      </div>
                      <p className="text-slate-500 mb-6">Khởi công ngày: {selectedProject.start_date}</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 uppercase font-bold mb-1">Tổng ngân sách</p>
                          <p className="text-xl font-bold text-slate-900">{formatCurrency(selectedProject.budget)}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 uppercase font-bold mb-1">Đã chi tiêu</p>
                          <p className="text-xl font-bold text-indigo-600">{formatCurrency(stats?.totals.total || 0)}</p>
                        </div>
                        <div className={cn(
                          "p-4 rounded-2xl border",
                          (stats?.profit || 0) >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                        )}>
                          <p className="text-xs text-slate-400 uppercase font-bold mb-1">Lợi nhuận dự kiến</p>
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "text-xl font-bold",
                              (stats?.profit || 0) >= 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {formatCurrency(stats?.profit || 0)}
                            </p>
                            {(stats?.profit || 0) >= 0 ? <TrendingUp size={18} className="text-emerald-500" /> : <TrendingDown size={18} className="text-red-500" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-64 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats?.chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {stats?.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Phân bổ chi phí</p>
                    </div>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 mb-8 gap-4">
                  <div className="flex overflow-x-auto">
                    <button 
                      onClick={() => setActiveTab('overview')}
                      className={cn(
                        "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap",
                        activeTab === 'overview' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Tổng quan
                    </button>
                    <button 
                      onClick={() => setActiveTab('labor')}
                      className={cn(
                        "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap",
                        activeTab === 'labor' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Nhân công
                    </button>
                    <button 
                      onClick={() => setActiveTab('materials')}
                      className={cn(
                        "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap",
                        activeTab === 'materials' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Vật tư
                    </button>
                    <button 
                      onClick={() => setActiveTab('others')}
                      className={cn(
                        "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap",
                        activeTab === 'others' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Chi phí khác
                    </button>
                    <button 
                      onClick={() => setActiveTab('photos')}
                      className={cn(
                        "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap",
                        activeTab === 'photos' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Hình ảnh thi công
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setNewExpense(prev => ({
                        ...prev,
                        category: activeTab === 'materials' ? ExpenseCategory.RAW_MATERIAL : 
                                 activeTab === 'others' ? ExpenseCategory.OTHER :
                                 ExpenseCategory.LABOR
                      }));
                      setShowAddExpense(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md mb-2 sm:mb-0"
                  >
                    <Plus size={18} />
                    Thêm chi phí
                  </button>
                </div>

                {activeTab === 'overview' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Summary Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white rounded-3xl border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Package size={20} className="text-indigo-600" />
                            Tổng hợp hạng mục
                          </h3>
                          <button 
                            onClick={() => {
                              setEditingProject(selectedProject);
                              setShowEditProject(true);
                            }}
                            className="text-indigo-600 text-xs font-bold hover:underline"
                          >
                            Sửa ngân sách
                          </button>
                        </div>
                        <div className="space-y-4">
                          {Object.values(ExpenseCategory).map((cat, idx) => (
                            <div key={cat} className="flex flex-col gap-1">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">{CATEGORY_LABELS[cat]}</span>
                                <span className="font-bold text-slate-900">{formatCurrency(stats?.totals[cat] || 0)}</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full" 
                                  style={{ 
                                    width: `${stats?.totals.total ? ((stats.totals[cat] || 0) / stats.totals.total) * 100 : 0}%`,
                                    backgroundColor: COLORS[idx % COLORS.length]
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                          <AlertCircle size={20} />
                          Phân tích tài chính
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <p className="text-indigo-200 text-xs uppercase font-bold tracking-widest mb-1">Tỷ lệ chi tiêu</p>
                            <p className="text-2xl font-black">
                              {selectedProject.budget > 0 ? ((stats?.totals.total || 0) / selectedProject.budget * 100).toFixed(1) : 0}%
                            </p>
                            <p className="text-xs text-indigo-300 mt-1">so với tổng ngân sách dự kiến</p>
                          </div>
                          <div className="pt-4 border-t border-indigo-800">
                            <p className="text-indigo-200 text-xs uppercase font-bold tracking-widest mb-1">Tỷ suất lợi nhuận</p>
                            <p className={cn(
                              "text-2xl font-black",
                              (stats?.profitMargin || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                              {stats?.profitMargin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                      {/* Owner Payments Section */}
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <DollarSign className="text-emerald-600" />
                            Tiền chủ đầu tư ứng
                          </h3>
                          <button 
                            onClick={() => setShowAddOwnerPayment(true)}
                            className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
                          >
                            <Plus size={16} />
                            Ghi nhận ứng tiền
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                            <p className="text-xs text-emerald-600 uppercase font-bold mb-1">Tổng đã nhận</p>
                            <p className="text-2xl font-black text-emerald-700">{formatCurrency(stats?.totalReceived || 0)}</p>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Tổng đã chi</p>
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats?.totals.total || 0)}</p>
                          </div>
                          <div className={cn(
                            "p-6 rounded-3xl border",
                            (stats?.balanceWithOwner || 0) >= 0 ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"
                          )}>
                            <p className={cn(
                              "text-xs uppercase font-bold mb-1",
                              (stats?.balanceWithOwner || 0) >= 0 ? "text-blue-600" : "text-red-600"
                            )}>Còn lại (Tiền mặt)</p>
                            <p className={cn(
                              "text-2xl font-black",
                              (stats?.balanceWithOwner || 0) >= 0 ? "text-blue-700" : "text-red-700"
                            )}>{formatCurrency(stats?.balanceWithOwner || 0)}</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-4 py-3">Ngày</th>
                                <th className="px-4 py-3">Nội dung</th>
                                <th className="px-4 py-3 text-right">Số tiền</th>
                                <th className="px-4 py-3"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {selectedProject.owner_payments?.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic text-sm">Chưa có đợt ứng nào</td>
                                </tr>
                              ) : (
                                selectedProject.owner_payments?.map((p) => (
                                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-4 py-3 text-sm text-slate-600">{p.date}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{p.note}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">{formatCurrency(p.amount)}</td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button 
                                          onClick={() => {
                                            setEditingOwnerPayment(p);
                                            setShowEditOwnerPayment(true);
                                          }}
                                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 hover:bg-indigo-50 rounded-md"
                                          title="Sửa đợt ứng"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteOwnerPayment(p.id)}
                                          className="text-slate-400 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-md"
                                          title="Xóa đợt ứng"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <h3 className="font-bold text-slate-900">Chi phí gần đây</h3>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {selectedProject.expenses?.slice(0, 5).length || 0} giao dịch mới nhất
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <tbody className="divide-y divide-slate-50">
                              {selectedProject.expenses?.slice(0, 5).map((expense) => (
                                <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{expense.date}</td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                                      expense.category === ExpenseCategory.LABOR && "bg-blue-100 text-blue-700",
                                      expense.category === ExpenseCategory.CONTRACTED_LABOR && "bg-purple-100 text-purple-700",
                                      expense.category === ExpenseCategory.RAW_MATERIAL && "bg-amber-100 text-amber-700",
                                      expense.category === ExpenseCategory.FINISHING_MATERIAL && "bg-emerald-100 text-emerald-700",
                                      expense.category === ExpenseCategory.OTHER && "bg-slate-100 text-slate-700"
                                    )}>
                                      {CATEGORY_LABELS[expense.category]}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{expense.description}</td>
                                  <td className="px-6 py-4 text-xs text-slate-500 text-center">
                                    {expense.quantity ? `${expense.quantity} ${expense.unit || ''}` : ''}
                                  </td>
                                  <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right whitespace-nowrap">
                                    {formatCurrency(expense.amount)}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                          <button 
                                            onClick={() => {
                                              setEditingExpense(expense);
                                              setShowEditExpense(true);
                                            }}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 hover:bg-indigo-50 rounded-md"
                                            title="Sửa chi phí"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteExpense(expense.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-md"
                                            title="Xóa chi phí"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                          <button 
                            onClick={() => setActiveTab('labor')}
                            className="text-indigo-600 text-sm font-bold hover:underline"
                          >
                            Xem tất cả chi tiết &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'photos' ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-900">Hình ảnh tiến độ</h3>
                      <button 
                        onClick={() => setShowAddPhoto(true)}
                        className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        <Plus size={18} />
                        Thêm ảnh mới
                      </button>
                    </div>
                    
                    {selectedProject.photos?.length === 0 ? (
                      <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                        <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">Chưa có ảnh thi công</h3>
                        <p className="text-slate-500">Lưu lại những khoảnh khắc quan trọng của công trình.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {selectedProject.photos?.map((photo) => (
                          <div key={photo.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden group">
                            <div className="aspect-video relative overflow-hidden bg-slate-100">
                              <img 
                                src={photo.image_url} 
                                alt={photo.description} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                              <button 
                                onClick={() => handleDeletePhoto(photo.id)}
                                className="absolute top-2 right-2 bg-white/90 backdrop-blur p-2 rounded-lg text-red-500 transition-opacity shadow-sm"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="p-4">
                              <p className="text-sm font-medium text-slate-900 mb-1">{photo.description || 'Không có mô tả'}</p>
                              <p className="text-xs text-slate-500">{photo.date}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Detailed Material Summary for Materials Tab */}
                    {activeTab === 'materials' && (
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                          <Layers size={20} className="text-indigo-600" />
                          Tổng hợp vật tư chi tiết
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {Object.entries(
                            selectedProject.expenses?.filter(e => 
                              e.category === ExpenseCategory.RAW_MATERIAL || e.category === ExpenseCategory.FINISHING_MATERIAL
                            ).reduce((acc, e) => {
                              acc[e.description] = (acc[e.description] || 0) + e.amount;
                              return acc;
                            }, {} as Record<string, number>) || {}
                          ).map(([name, amount]) => (
                            <div key={name} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <p className="text-xs text-slate-400 uppercase font-bold mb-1 truncate" title={name}>{name}</p>
                              <p className="text-lg font-bold text-slate-900">{formatCurrency(amount as number)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sub-sections for Labor or Materials or Others */}
                    {(activeTab === 'labor' ? [ExpenseCategory.LABOR, ExpenseCategory.CONTRACTED_LABOR] : 
                      activeTab === 'materials' ? [ExpenseCategory.RAW_MATERIAL, ExpenseCategory.FINISHING_MATERIAL] :
                      [ExpenseCategory.OTHER]
                    ).map((cat) => {
                      const filteredExpenses = selectedProject.expenses?.filter(e => e.category === cat) || [];
                      const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

                      return (
                        <div key={cat} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-xl",
                                cat === ExpenseCategory.LABOR && "bg-blue-100 text-blue-600",
                                cat === ExpenseCategory.CONTRACTED_LABOR && "bg-purple-100 text-purple-600",
                                cat === ExpenseCategory.RAW_MATERIAL && "bg-amber-100 text-amber-600",
                                cat === ExpenseCategory.FINISHING_MATERIAL && "bg-emerald-100 text-emerald-600",
                                cat === ExpenseCategory.OTHER && "bg-slate-100 text-slate-600"
                              )}>
                                {cat === ExpenseCategory.LABOR || cat === ExpenseCategory.CONTRACTED_LABOR ? <HardHat size={20} /> : 
                                 cat === ExpenseCategory.OTHER ? <DollarSign size={20} /> : <Package size={20} />}
                              </div>
                              <h3 className="font-bold text-slate-900">{CATEGORY_LABELS[cat]}</h3>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Tổng cộng</p>
                              <p className="text-lg font-black text-indigo-600">{formatCurrency(total)}</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                  <th className="px-6 py-4">Ngày</th>
                                  <th className="px-6 py-4">Mô tả</th>
                                  <th className="px-6 py-4 text-center">Khối lượng</th>
                                  <th className="px-6 py-4 text-right">Số tiền</th>
                                  <th className="px-6 py-4"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {filteredExpenses.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                      Chưa có chi phí nào trong hạng mục này
                                    </td>
                                  </tr>
                                ) : (
                                  filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{expense.date}</td>
                                      <td className="px-6 py-4">
                                        <div className="space-y-1">
                                          <p className="text-sm text-slate-900 font-medium">{expense.description}</p>
                                          {expense.payments && expense.payments.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {expense.payments.map((p, idx) => (
                                                <span key={p.id} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                                  Ứng {idx + 1}: {formatCurrency(p.amount)}
                                                  <button 
                                                    onClick={() => handleDeleteExpensePayment(p.id)} 
                                                    className="hover:text-red-500 ml-1 p-0.5 rounded-full hover:bg-red-50 transition-colors"
                                                    title="Xóa đợt ứng"
                                                  >
                                                    <Plus size={10} className="rotate-45" />
                                                  </button>
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-slate-600 text-center whitespace-nowrap">
                                        {expense.quantity ? `${expense.quantity} ${expense.unit || ''}` : '-'}
                                      </td>
                                      <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right whitespace-nowrap">
                                        <div className="flex flex-col items-end">
                                          <span>{formatCurrency(expense.amount)}</span>
                                          {expense.payments && expense.payments.length > 0 && (
                                            <span className="text-[10px] text-slate-400">Đã ứng: {formatCurrency(expense.payments.reduce((s, p) => s + p.amount, 0))}</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button 
                                            onClick={() => {
                                              setSelectedExpenseId(expense.id);
                                              setShowAddExpensePayment(true);
                                            }}
                                            className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                                            title="Ghi nhận ứng tiền"
                                          >
                                            <DollarSign size={16} />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setEditingExpense(expense);
                                              setShowEditExpense(true);
                                            }}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 hover:bg-indigo-50 rounded-md"
                                            title="Sửa chi phí"
                                          >
                                            <Pencil size={16} />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteExpense(expense.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-md"
                                            title="Xóa chi phí"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                                      })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Add Owner Payment Modal */}
      {showAddOwnerPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Ghi nhận chủ đầu tư ứng</h2>
            <form onSubmit={handleAddOwnerPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
  Số tiền ứng (VNĐ)
</label>

<NumericInput
  required
  value={editingOwnerPayment?.amount}
  onChange={(val) =>
    setEditingOwnerPayment({
      ...editingOwnerPayment!,
      amount: val,
    })
  }
  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nội dung / Ghi chú</label>
                <input 
                  type="text" 
                  required
                  value={newOwnerPayment.note || ''}
                  onChange={(e) => setNewOwnerPayment({...newOwnerPayment, note: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="VD: Ứng đợt 1 sau khi xong móng"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ngày nhận</label>
                <input 
                  type="date" 
                  required
                  value={newOwnerPayment.date || ''}
                  onChange={(e) => setNewOwnerPayment({...newOwnerPayment, date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
             <div className="flex gap-3 pt-4">
  <button 
    type="button"
    onClick={() => setShowAddOwnerPayment(false)}
    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
  >
    Hủy
  </button>

  <button 
    type="submit"
    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all"
  >
    Lưu thông tin
  </button>
</div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Payment Modal */}
      {showAddExpensePayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Ghi nhận tạm ứng chi phí</h2>
            <form onSubmit={handleAddExpensePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Số tiền ứng (VNĐ)</label>
                <NumericInput 
                  required
                  value={newExpensePayment.amount}
                  onChange={(val) => setNewExpensePayment({...newExpensePayment, amount: val})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ghi chú</label>
                <input 
                  type="text" 
                  value={newExpensePayment.note || ''}
                  onChange={(e) => setNewExpensePayment({...newExpensePayment, note: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="VD: Ứng tiền mua gạch"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ngày ứng</label>
                <input 
                  type="date" 
                  required
                  value={newExpensePayment.date || ''}
                  onChange={(e) => setNewExpensePayment({...newExpensePayment, date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddExpensePayment(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all"
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAddPhoto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Thêm ảnh thi công</h2>
            <form onSubmit={handleAddPhoto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Chọn ảnh</label>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full aspect-video rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {newPhoto.image_url ? (
                      <img src={newPhoto.image_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Calendar className="text-slate-300 w-12 h-12" />
                    )}
                  </div>
                  <label className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors text-center">
                    Tải ảnh lên
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, (url) => setNewPhoto({...newPhoto, image_url: url}))} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Mô tả</label>
                <input 
                  type="text" 
                  value={newPhoto.description || ''}
                  onChange={(e) => setNewPhoto({...newPhoto, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="VD: Đổ sàn tầng 1"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ngày chụp</label>
                <input 
                  type="date" 
                  required
                  value={newPhoto.date || ''}
                  onChange={(e) => setNewPhoto({...newPhoto, date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddPhoto(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={!newPhoto.image_url}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all"
                >
                  Lưu ảnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Thêm công trình mới</h2>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ảnh công trình</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {newProject.image_url ? (
                      <img src={newProject.image_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Hammer className="text-slate-300" />
                    )}
                  </div>
                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors">
                    Chọn ảnh
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, (url) => setNewProject({...newProject, image_url: url}))} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tên công trình</label>
                <input 
                  type="text" 
                  required
                  value={newProject.name || ''}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="VD: Nhà phố Quận 7"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ngân sách dự kiến (VNĐ)</label>
                <NumericInput 
                  required
                  value={newProject.budget}
                  onChange={(val) => setNewProject({...newProject, budget: val})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ngày bắt đầu</label>
                <input 
                  type="date" 
                  required
                  value={newProject.start_date || ''}
                  onChange={(e) => setNewProject({...newProject, start_date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all"
                >
                  Tạo công trình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProject && editingProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Chỉnh sửa công trình</h2>
            <form onSubmit={handleEditProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ảnh công trình</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {editingProject.image_url ? (
                      <img src={editingProject.image_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Hammer className="text-slate-300" />
                    )}
                  </div>
                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors">
                    Đổi ảnh
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, (url) => setEditingProject({...editingProject, image_url: url}))} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tên công trình</label>
                <input 
                  type="text" 
                  required
                  value={editingProject.name || ''}
                  onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ngân sách (VNĐ)</label>
                <NumericInput 
                  required
                  value={editingProject.budget}
                  onChange={(val) => setEditingProject({...editingProject, budget: val})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ngày bắt đầu</label>
                <input 
                  type="date" 
                  required
                  value={editingProject.start_date || ''}
                  onChange={(e) => setEditingProject({...editingProject, start_date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowEditProject(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Ghi nhận chi phí</h3>
              <button onClick={() => setShowAddExpense(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Hạng mục</label>
                <select 
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({...newExpense, category: e.target.value as ExpenseCategory})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  {Object.values(ExpenseCategory).map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mô tả chi tiết</label>
                <input 
                  required
                  type="text" 
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ví dụ: Thanh toán lương tuần 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Khối lượng</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={newExpense.quantity}
                    onChange={(e) => setNewExpense({...newExpense, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Đơn vị</label>
                  <input 
                    type="text" 
                    value={newExpense.unit}
                    onChange={(e) => setNewExpense({...newExpense, unit: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="m2, m3, cái..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Số tiền (VND)</label>
                <NumericInput 
                  required
                  value={newExpense.amount}
                  onChange={(val) => setNewExpense({...newExpense, amount: val})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ngày chi</label>
                <input 
                  required
                  type="date" 
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all">
                  Lưu chi phí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Expense Modal */}
      {showEditExpense && editingExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Chỉnh sửa chi phí</h3>
              <button onClick={() => setShowEditExpense(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleUpdateExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Hạng mục</label>
                <select 
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({...editingExpense, category: e.target.value as ExpenseCategory})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  {Object.values(ExpenseCategory).map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mô tả chi tiết</label>
                <input 
                  required
                  type="text" 
                  value={editingExpense.description || ''}
                  onChange={(e) => setEditingExpense({...editingExpense, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Khối lượng</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingExpense.quantity ?? 0}
                    onChange={(e) => setEditingExpense({...editingExpense, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Đơn vị</label>
                  <input 
                    type="text" 
                    value={editingExpense.unit || ''}
                    onChange={(e) => setEditingExpense({...editingExpense, unit: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="m2, m3, cái..."
                  />
                </div>
              </div>
              <div>
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
    Số tiền (VND)
  </label>
  <NumericInput 
    required
    value={editingExpense.amount}
    onChange={(val) => setEditingExpense({...editingExpense, amount: val})}
    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
  />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ngày chi</label>
                <input 
                  required
                  type="date" 
                  value={editingExpense.date || ''}
                  onChange={(e) => setEditingExpense({...editingExpense, date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all">
                  Cập nhật chi phí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Owner Payment Modal */}
     {showEditOwnerPayment && editingOwnerPayment && (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
      <h2 className="text-2xl font-black text-slate-900 mb-6">
        Sửa thông tin ứng tiền
      </h2>

      <form onSubmit={handleUpdateOwnerPayment} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Số tiền ứng (VNĐ)
          </label>
          <NumericInput
            required
            value={editingOwnerPayment.amount}
            onChange={(val) =>
              setEditingOwnerPayment({
                ...editingOwnerPayment,
                amount: val,
              })
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Nội dung / Ghi chú
          </label>
          <input
            type="text"
            required
            value={editingOwnerPayment.note || ""}
            onChange={(e) =>
              setEditingOwnerPayment({
                ...editingOwnerPayment,
                note: e.target.value,
              })
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Ngày nhận
          </label>
          <input
            type="date"
            required
            value={editingOwnerPayment.date || ""}
            onChange={(e) =>
              setEditingOwnerPayment({
                ...editingOwnerPayment,
                date: e.target.value,
              })
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setShowEditOwnerPayment(false)}
            className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl"
          >
            Hủy
          </button>

          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl"
          >
            Cập nhật
          </button>
        </div>
      </form>
    </div>
  </div>
)}
