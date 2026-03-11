import React, { useState, useEffect } from 'react';
import { HOT_ROLES, HOT_INDUSTRIES } from './constants';
import { 
  Search, 
  MapPin, 
  Globe, 
  Mail, 
  Phone, 
  Star, 
  Users,
  ExternalLink, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Send,
  FileText,
  Zap,
  Edit3,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';
import { findLeads, findLinkedInLeads, analyzeWebsite, generatePitch, reframePitch, type BusinessLead } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Lead extends BusinessLead {
  status: 'new' | 'analyzing' | 'analyzed' | 'pitching' | 'pitched' | 'sent';
  analysis?: string;
  pitch?: string;
}

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('Plumbers in Austin');
  const [linkedinFilters, setLinkedinFilters] = useState({
    industry: '',
    jobTitle: 'Owner',
    location: ''
  });
  const [searchMode, setSearchMode] = useState<'maps' | 'linkedin'>('maps');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isEditingPitch, setIsEditingPitch] = useState(false);
  const [reframeFeedback, setReframeFeedback] = useState('');
  const [testEmail, setTestEmail] = useState('manjakaslt@gmail.com');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      console.error('Failed to fetch leads', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      let foundLeads: BusinessLead[] = [];
      
      if (searchMode === 'maps') {
        foundLeads = await findLeads(searchQuery);
      } else {
        foundLeads = await findLinkedInLeads(linkedinFilters);
      }
      
      // Save leads to backend
      for (const lead of foundLeads) {
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        });
      }
      
      await fetchLeads();
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAnalyze = async (lead: Lead) => {
    console.log("handleAnalyze called for:", lead.name, "website:", lead.website);
    if (!lead.website) {
      console.warn("No website URL for lead:", lead.name);
      alert("No website URL available for this lead.");
      return;
    }
    setIsProcessing(lead.id);
    console.log("isProcessing set to:", lead.id);
    try {
      console.log("Calling analyzeWebsite...");
      const analysis = await analyzeWebsite(lead.name, lead.website);
      console.log("Analysis result:", analysis);
      if (!analysis) throw new Error("No analysis returned");
      console.log("Calling PATCH /api/leads/", lead.id);
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, status: 'analyzed' }),
      });
      console.log("PATCH response:", response.status);
      if (!response.ok) throw new Error(`PATCH failed with status ${response.status}`);
      await fetchLeads();
    } catch (err) {
      console.error('Analysis failed', err);
      alert('Failed to analyze website. Please try again. Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      console.log("isProcessing set to null");
      setIsProcessing(null);
    }
  };

  const handleGeneratePitch = async (lead: Lead) => {
    if (!lead.analysis) return;
    setIsProcessing(lead.id);
    try {
      const pitch = await generatePitch(lead.name, lead.analysis);
      await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch, status: 'pitched' }),
      });
      await fetchLeads();
    } catch (err) {
      console.error('Pitch generation failed', err);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleVerifyEmail = async (email: string) => {
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return await res.json();
    } catch (err) {
      console.error('Email verification failed', err);
      return { valid: false, reason: 'Verification service error' };
    }
  };

  const handleSendEmail = async (lead: Lead, customTo?: string) => {
    const recipient = customTo || lead.email;
    if (!lead.pitch || !recipient) {
      alert('Please provide an email address and generate a pitch first.');
      return;
    }
    setIsProcessing(lead.id + (customTo ? '-test' : ''));
    
    // Verify email first
    const verification = await handleVerifyEmail(recipient);
    if (!verification.valid) {
      alert(`Email verification failed for ${recipient}: ${verification.reason}. Please check the email address.`);
      setIsProcessing(null);
      return;
    }

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: `Website Redesign Proposal for ${lead.name}`,
          html: lead.pitch.replace(/\n/g, '<br>'),
        }),
      });
      
      if (res.ok) {
        if (!customTo) {
          await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'sent' }),
          });
          await fetchLeads();
        }
        alert(`Email sent successfully to ${recipient}!`);
      } else {
        const err = await res.json();
        const errorMessage = err.error || err.message || 'Unknown error';
        alert(`Failed to send email: ${errorMessage}\n\nNote: If using Resend free tier, you can only send to verified email addresses. Alternatively, use the 'Open in Email App' button.`);
      }
    } catch (err) {
      console.error('Email sending failed', err);
      alert('Failed to send email. Check console for details.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleUpdatePitch = async (leadId: string, pitch: string) => {
    try {
      await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch }),
      });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pitch } : l));
    } catch (err) {
      console.error('Failed to update pitch', err);
    }
  };

  const handleReframe = async (lead: Lead) => {
    if (!reframeFeedback) return;
    setIsProcessing(lead.id + '-reframe');
    try {
      const newPitch = await reframePitch(lead.name, lead.pitch || '', reframeFeedback);
      await handleUpdatePitch(lead.id, newPitch);
      setReframeFeedback('');
    } catch (err) {
      console.error('Reframe failed', err);
    } finally {
      setIsProcessing(null);
    }
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter flex items-center gap-2">
            <Zap className="w-6 h-6 fill-current" />
            LEADGEN.AI
          </h1>
          <p className="text-xs uppercase tracking-widest opacity-50 mt-1 font-mono">
            Outreach Intelligence System v1.0
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={async () => {
              const readyLeads = leads.filter(l => l.status === 'pitched' && l.email);
              if (readyLeads.length === 0) {
                alert('No leads ready for bulk sending. Ensure they have a pitch and an email address.');
                return;
              }
              if (confirm(`Send emails to ${readyLeads.length} leads?`)) {
                for (const lead of readyLeads) {
                  await handleSendEmail(lead);
                }
              }
            }}
            className="text-xs font-bold border border-[#141414] px-4 py-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all flex items-center gap-2"
          >
            <Send className="w-3 h-3" />
            BULK SEND ({leads.filter(l => l.status === 'pitched' && l.email).length})
          </button>
          <div className="text-right">
            <p className="text-[10px] uppercase font-mono opacity-50">System Status</p>
            <p className="text-xs font-bold flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              OPERATIONAL
            </p>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-88px)]">
        {/* Sidebar / List */}
        <div className="lg:col-span-4 border-r border-[#141414] flex flex-col">
          <div className="p-4 border-b border-[#141414] space-y-4">
            <div className="flex border border-[#141414] p-1 bg-[#F5F5F0]">
              <button 
                onClick={() => setSearchMode('maps')}
                className={cn(
                  "flex-1 py-1.5 text-[10px] uppercase font-mono transition-all",
                  searchMode === 'maps' ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414]/10"
                )}
              >
                Google Maps
              </button>
              <button 
                onClick={() => setSearchMode('linkedin')}
                className={cn(
                  "flex-1 py-1.5 text-[10px] uppercase font-mono transition-all",
                  searchMode === 'linkedin' ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414]/10"
                )}
              >
                LinkedIn
              </button>
            </div>
            {searchMode === 'maps' ? (
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Plumbers in Austin"
                  className="w-full bg-transparent border border-[#141414] px-4 py-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-[#141414] placeholder:opacity-30 text-sm"
                />
                <button 
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSearch} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono opacity-50">Job Title</label>
                  <input
                    type="text"
                    value={linkedinFilters.jobTitle}
                    onChange={(e) => setLinkedinFilters(prev => ({ ...prev, jobTitle: e.target.value }))}
                    placeholder="e.g. Owner, CEO, Founder"
                    className="w-full bg-transparent border border-[#141414] px-3 py-2 focus:outline-none text-sm"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {HOT_ROLES.map(role => (
                      <button key={role} type="button" onClick={() => setLinkedinFilters(prev => ({ ...prev, jobTitle: role }))} className="text-[9px] bg-[#141414]/10 px-1.5 py-0.5 hover:bg-[#141414]/20 transition-colors">
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono opacity-50">Industry</label>
                  <input
                    type="text"
                    value={linkedinFilters.industry}
                    onChange={(e) => setLinkedinFilters(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g. Real Estate, SaaS, E-commerce"
                    className="w-full bg-transparent border border-[#141414] px-3 py-2 focus:outline-none text-sm"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {HOT_INDUSTRIES.map(industry => (
                      <button key={industry} type="button" onClick={() => setLinkedinFilters(prev => ({ ...prev, industry: industry }))} className="text-[9px] bg-[#141414]/10 px-1.5 py-0.5 hover:bg-[#141414]/20 transition-colors">
                        {industry}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono opacity-50">Location</label>
                  <input
                    type="text"
                    value={linkedinFilters.location}
                    onChange={(e) => setLinkedinFilters(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. New York, London, Remote"
                    className="w-full bg-transparent border border-[#141414] px-3 py-2 focus:outline-none text-sm"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSearching}
                  className="w-full bg-[#141414] text-[#E4E3E0] py-2.5 text-xs font-bold hover:bg-opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  SCRAPE LINKEDIN LEADS
                </button>
              </form>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-bold flex justify-between items-center">
              <span>SAVED LEADS DATABASE</span>
              <span className="opacity-50 font-mono">{leads.length} RECORDS</span>
            </div>
            <div className="grid grid-cols-4 px-4 py-2 border-b border-[#141414] text-[10px] uppercase font-mono opacity-50">
              <div className="col-span-2">Business / Person</div>
              <div>Status</div>
              <div className="text-right">Action</div>
            </div>
            {leads.length === 0 ? (
              <div className="p-8 text-center opacity-30 italic text-sm">
                No leads found. Start a search to find potential clients.
              </div>
            ) : (
              leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={cn(
                    "w-full text-left grid grid-cols-4 px-4 py-4 border-b border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group",
                    selectedLeadId === lead.id && "bg-[#141414] text-[#E4E3E0]"
                  )}
                >
                  <div className="col-span-2 pr-4">
                    <p className="font-bold truncate text-sm">{lead.name}</p>
                    <p className="text-[10px] opacity-50 truncate font-mono mt-0.5">
                      {lead.linkedin ? 'LinkedIn Profile' : (lead.website || 'No website found')}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <span className={cn(
                      "text-[10px] uppercase font-mono px-1.5 py-0.5 border",
                      lead.status === 'sent' ? "border-emerald-500 text-emerald-500" : 
                      lead.status === 'pitched' ? "border-blue-500 text-blue-500" :
                      lead.status === 'analyzed' ? "border-amber-500 text-amber-500" :
                      "border-[#141414] group-hover:border-[#E4E3E0]"
                    )}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="flex justify-end items-center">
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-8 bg-white/50 overflow-y-auto">
          {selectedLead ? (
            <div className="p-8 max-w-3xl mx-auto">
              {/* Lead Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-4xl font-bold tracking-tighter mb-2">{selectedLead.name}</h2>
                  {selectedLead.role && <p className="text-lg font-medium opacity-80 mb-2">{selectedLead.role}</p>}
                  <div className="flex flex-wrap gap-4 text-sm opacity-70">
                    {selectedLead.company_size && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" /> Company Size: {selectedLead.company_size}
                      </span>
                    )}
                    {selectedLead.linkedin && (
                      <a href={selectedLead.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline text-blue-600">
                        <ExternalLink className="w-4 h-4" /> LinkedIn Profile
                      </a>
                    )}
                    {selectedLead.website && (
                      <a href={selectedLead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                        <Globe className="w-4 h-4" /> {selectedLead.website}
                      </a>
                    )}
                    {selectedLead.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {selectedLead.address}
                      </span>
                    )}
                    {selectedLead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" /> {selectedLead.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end mb-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold">{selectedLead.rating || 'N/A'}</span>
                    <span className="text-xs opacity-50">({selectedLead.user_ratings_total || 0})</span>
                  </div>
                  <p className="text-[10px] uppercase font-mono opacity-50">Lead Rating</p>
                </div>
              </div>

              {/* Workflow Steps */}
              <div className="space-y-8">
                {/* Step 1: Website Analysis */}
                <section className="border border-[#141414] p-6 bg-white shadow-[4px_4px_0px_0px_#141414]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      1. Website Analysis
                    </h3>
                    {!selectedLead.analysis ? (
                      <button
                        onClick={() => handleAnalyze(selectedLead)}
                        disabled={isProcessing === selectedLead.id || !selectedLead.website}
                        className="bg-[#141414] text-[#E4E3E0] px-4 py-1.5 text-xs font-bold hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isProcessing === selectedLead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        RUN ANALYSIS
                      </button>
                    ) : (
                      <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" /> COMPLETED
                      </span>
                    )}
                  </div>
                  
                  {selectedLead.analysis ? (
                    <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight">
                      <Markdown>{selectedLead.analysis}</Markdown>
                    </div>
                  ) : (
                    <p className="text-sm opacity-50 italic">
                      {selectedLead.website ? 'Click "Run Analysis" to identify website issues.' : 'No website URL available for analysis.'}
                    </p>
                  )}
                </section>

                {/* Step 2: Personalized Pitch */}
                <section className="border border-[#141414] p-6 bg-white shadow-[4px_4px_0px_0px_#141414]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      2. Outreach Pitch
                    </h3>
                    {!selectedLead.pitch ? (
                      <button
                        onClick={() => handleGeneratePitch(selectedLead)}
                        disabled={isProcessing === selectedLead.id || !selectedLead.analysis}
                        className="bg-[#141414] text-[#E4E3E0] px-4 py-1.5 text-xs font-bold hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isProcessing === selectedLead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        GENERATE PITCH
                      </button>
                    ) : (
                      <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" /> COMPLETED
                      </span>
                    )}
                  </div>
                  
                  {selectedLead.pitch ? (
                    <div className="space-y-4">
                      <div className="relative group">
                        {isEditingPitch ? (
                          <textarea
                            value={selectedLead.pitch}
                            onChange={(e) => {
                              const pitch = e.target.value;
                              setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, pitch } : l));
                            }}
                            className="w-full h-48 p-4 bg-white border border-[#141414] text-sm font-mono focus:outline-none resize-none"
                          />
                        ) : (
                          <div className="p-4 bg-[#F5F5F0] border border-[#141414] text-sm font-mono whitespace-pre-wrap min-h-[100px]">
                            {selectedLead.pitch}
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-2">
                          {isEditingPitch ? (
                            <button
                              onClick={() => {
                                handleUpdatePitch(selectedLead.id, selectedLead.pitch || '');
                                setIsEditingPitch(false);
                              }}
                              className="bg-emerald-600 text-white p-1.5 hover:bg-emerald-700 shadow-[2px_2px_0px_0px_#141414]"
                              title="Save Changes"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setIsEditingPitch(true)}
                              className="bg-white border border-[#141414] p-1.5 hover:bg-[#F5F5F0] shadow-[2px_2px_0px_0px_#141414]"
                              title="Edit Pitch"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reframe Tool */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={reframeFeedback}
                          onChange={(e) => setReframeFeedback(e.target.value)}
                          placeholder="e.g., Make it shorter, more professional..."
                          className="flex-1 bg-transparent border border-[#141414] px-3 py-1.5 text-xs focus:outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && handleReframe(selectedLead)}
                        />
                        <button
                          onClick={() => handleReframe(selectedLead)}
                          disabled={!reframeFeedback || isProcessing === selectedLead.id + '-reframe'}
                          className="bg-[#141414] text-white px-4 py-1.5 text-xs font-bold hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isProcessing === selectedLead.id + '-reframe' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          REFRAME
                        </button>
                      </div>

                      <div className="flex gap-4 items-end">
                        <div className="flex-1">
                          <label className="block text-[10px] uppercase font-mono opacity-50 mb-1">Target Email</label>
                          <input 
                            type="email"
                            value={selectedLead.email || ''}
                            onChange={(e) => {
                              const email = e.target.value;
                              setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, email } : l));
                            }}
                            onBlur={async (e) => {
                              await fetch(`/api/leads/${encodeURIComponent(selectedLead.id)}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: e.target.value }),
                              });
                            }}
                            placeholder="owner@business.com"
                            className="w-full bg-transparent border border-[#141414] px-3 py-2 text-sm focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSendEmail(selectedLead)}
                              disabled={isProcessing?.toString().startsWith(selectedLead.id) || !selectedLead.email}
                              className="bg-emerald-600 text-white px-6 py-2 text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                            >
                              {isProcessing === selectedLead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              SEND VIA RESEND
                            </button>
                            <button
                              onClick={() => {
                                const subject = encodeURIComponent(`Website Redesign Proposal for ${selectedLead.name}`);
                                const body = encodeURIComponent(selectedLead.pitch || '');
                                window.open(`mailto:${selectedLead.email}?subject=${subject}&body=${body}`);
                                
                                // Mark as sent
                                fetch(`/api/leads/${encodeURIComponent(selectedLead.id)}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'sent' }),
                                }).then(() => fetchLeads());
                              }}
                              disabled={!selectedLead.email || !selectedLead.pitch}
                              className="bg-transparent border border-[#141414] text-[#141414] px-6 py-2 text-sm font-bold hover:bg-[#141414] hover:text-[#E4E3E0] disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                              <Mail className="w-4 h-4" />
                              OPEN IN EMAIL APP
                            </button>
                          </div>
                          
                          {/* Test Send Section */}
                          <div className="flex gap-2 items-center border-t border-[#141414] pt-2">
                            <input 
                              type="email"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              placeholder="Your email for testing"
                              className="flex-1 bg-transparent border border-[#141414] px-2 py-1 text-[10px] focus:outline-none"
                            />
                            <button
                              onClick={() => handleSendEmail(selectedLead, testEmail)}
                              disabled={isProcessing?.toString().startsWith(selectedLead.id) || !testEmail}
                              className="bg-[#141414] text-white px-3 py-1 text-[10px] font-bold hover:bg-opacity-80 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isProcessing === selectedLead.id + '-test' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              TEST SEND TO ME
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm opacity-50 italic">
                      Analyze the website first to generate a personalized pitch.
                    </p>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 border border-[#141414] flex items-center justify-center mb-6">
                <Search className="w-12 h-12 opacity-20" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">No Lead Selected</h3>
              <p className="text-sm opacity-50 max-w-xs">
                Select a lead from the sidebar to view analysis, generate pitches, and start outreach.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-[#141414] px-6 py-2 flex justify-between items-center text-[10px] font-mono opacity-50">
        <div className="flex gap-6">
          <span>LEADS: {leads.length}</span>
          <span>SENT: {leads.filter(l => l.status === 'sent').length}</span>
        </div>
        <div className="flex gap-4">
          <span>API: CONNECTED</span>
          <span>DB: LOCAL_SQLITE</span>
        </div>
      </footer>
    </div>
  );
}
