import React, { useState, useEffect } from 'react';
import { Search, User, FileText, Share2, Sparkles, X, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useMedicalStore, AI_SYMPTOM_DATABASE } from '@/context/MedicalStore';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, extraId?: string) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const { patients, records, referrals, quickSearch, isOracleConnected } = useMedicalStore();
  const [remoteSymptoms, setRemoteSymptoms] = useState<{
    query: string;
    items: Array<{ id: string; title: string; content: string; score: number | null }>;
  } | null>(null);
  const [remoteSearchError, setRemoteSearchError] = useState<string | null>(null);
  const [isSearchingSymptoms, setIsSearchingSymptoms] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Trigger handled from parent or toggle
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cleanQ = query.trim().toLowerCase();

  useEffect(() => {
    if (!isOpen || !isOracleConnected || cleanQ.length < 2) {
      setRemoteSymptoms(null);
      setRemoteSearchError(null);
      setIsSearchingSymptoms(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingSymptoms(true);
    setRemoteSearchError(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await quickSearch(query.trim(), controller.signal);
        if (!controller.signal.aborted) {
          setRemoteSymptoms({ query: cleanQ, items: result?.symptoms || [] });
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setRemoteSymptoms({ query: cleanQ, items: [] });
          setRemoteSearchError(cause instanceof Error ? cause.message : 'Không thể tìm qua Oracle API.');
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingSymptoms(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cleanQ, isOpen, isOracleConnected, query, quickSearch]);

  const filteredPatients = cleanQ
    ? patients.filter(
        (p) =>
          p.full_name.toLowerCase().includes(cleanQ) ||
          p.medical_code.toLowerCase().includes(cleanQ) ||
          p.phone.includes(cleanQ)
      )
    : [];

  const filteredRecords = cleanQ
    ? records.filter(
        (r) =>
          r.record_code.toLowerCase().includes(cleanQ) ||
          r.patient_name.toLowerCase().includes(cleanQ) ||
          r.diagnosis_icd10.code.toLowerCase().includes(cleanQ) ||
          r.diagnosis_icd10.description.toLowerCase().includes(cleanQ)
      )
    : [];

  const filteredReferrals = cleanQ
    ? referrals.filter(
        (ref) =>
          ref.referral_code.toLowerCase().includes(cleanQ) ||
          ref.patient_name.toLowerCase().includes(cleanQ) ||
          ref.from_facility.toLowerCase().includes(cleanQ) ||
          ref.to_facility.toLowerCase().includes(cleanQ)
      )
    : [];

  const localSymptoms = cleanQ
    ? AI_SYMPTOM_DATABASE.filter(
        (s) =>
          s.title.toLowerCase().includes(cleanQ) ||
          s.content.toLowerCase().includes(cleanQ)
      )
    : [];
  const remoteResult = remoteSymptoms?.query === cleanQ ? remoteSymptoms.items : null;
  const filteredSymptoms = isOracleConnected
    ? (remoteResult || []).map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        cosine_distance: item.score === null ? undefined : (100 - item.score) / 100,
      }))
    : localSymptoms;

  const hasResults =
    filteredPatients.length > 0 ||
    filteredRecords.length > 0 ||
    filteredReferrals.length > 0 ||
    filteredSymptoms.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-border/80 shadow-2xl">
        <DialogTitle className="sr-only">Tìm kiếm thông minh ngữ nghĩa</DialogTitle>
        <div className="flex items-center border-b border-border px-4 py-3.5 bg-card">
          <Search className="h-5 w-5 text-primary shrink-0 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo Mã hồ sơ (BN-2024-001), Họ tên, Triệu chứng, Phác đồ, Phiếu chuyển viện..."
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!query && (
            <div className="py-8 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 text-primary/40 mx-auto mb-2 animate-pulse" />
              <p className="text-sm font-medium">Nhập từ khóa để tra cứu hồ sơ hoặc triệu chứng nhanh</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => setQuery('BN-2024-001')}
                  className="text-xs px-2.5 py-1 rounded bg-muted hover:bg-accent text-foreground transition-colors"
                >
                  BN-2024-001
                </button>
                <button
                  onClick={() => setQuery('đau thắt ngực')}
                  className="text-xs px-2.5 py-1 rounded bg-muted hover:bg-accent text-foreground transition-colors"
                >
                  Đau thắt ngực
                </button>
                <button
                  onClick={() => setQuery('chuyển viện')}
                  className="text-xs px-2.5 py-1 rounded bg-muted hover:bg-accent text-foreground transition-colors"
                >
                  Chuyển viện
                </button>
                <button
                  onClick={() => setQuery('Metformin')}
                  className="text-xs px-2.5 py-1 rounded bg-muted hover:bg-accent text-foreground transition-colors"
                >
                  Metformin
                </button>
              </div>
            </div>
          )}

          {isSearchingSymptoms && (
            <p className="text-center text-xs text-muted-foreground" role="status">
              Đang tìm triệu chứng trong Oracle 23ai...
            </p>
          )}

          {remoteSearchError && (
            <p className="text-center text-sm text-destructive" role="alert">{remoteSearchError}</p>
          )}

          {query && !hasResults && !isSearchingSymptoms && !remoteSearchError && (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Không tìm thấy kết quả phù hợp cho "{query}"</p>
              <p className="text-xs mt-1 text-muted-foreground/80">
                Thử tìm theo mã bệnh nhân (BN-2024-xxx) hoặc triệu chứng y khoa
              </p>
            </div>
          )}

          {/* Patient Results */}
          {filteredPatients.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" /> Bệnh Nhân ({filteredPatients.length})
              </h4>
              <div className="space-y-1.5">
                {filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onNavigate('patients', p.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/60 hover:border-primary/40 cursor-pointer transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{p.full_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-medium">
                          {p.medical_code}
                        </span>
                        <span className="text-xs text-muted-foreground">({p.gender}, {p.dob.split('-')[0]})</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Khoa: {p.department} • BHYT: {p.insurance_id}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical Records Results */}
          {filteredRecords.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" /> Bệnh Án & Chẩn Đoán ({filteredRecords.length})
              </h4>
              <div className="space-y-1.5">
                {filteredRecords.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      onNavigate('records', r.patient_id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/60 hover:border-primary/40 cursor-pointer transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{r.patient_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 font-mono">
                          {r.record_code}
                        </span>
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          {r.diagnosis_icd10.code}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {r.diagnosis_icd10.description} • BS: {r.doctor_name}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Knowledge / Symptom Matches */}
          {filteredSymptoms.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-sky-600" /> Triệu Chứng Y Khoa ({filteredSymptoms.length})
              </h4>
              <div className="space-y-1.5">
                {filteredSymptoms.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onNavigate('ai-search', query.trim());
                      onClose();
                    }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/60 hover:border-primary/40 cursor-pointer transition-all"
                  >
                    <div>
                      <span className="font-semibold text-foreground text-sm">{s.title}</span>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.content}</p>
                    </div>
                    {s.cosine_distance !== undefined && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded shrink-0">
                        {(100 - s.cosine_distance * 100).toFixed(1)}% khớp
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referrals */}
          {filteredReferrals.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-purple-600" /> Chuyển Tuyến Y Tế ({filteredReferrals.length})
              </h4>
              <div className="space-y-1.5">
                {filteredReferrals.map((ref) => (
                  <div
                    key={ref.id}
                    onClick={() => {
                      onNavigate('referrals');
                      onClose();
                    }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/60 hover:border-primary/40 cursor-pointer transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{ref.patient_name}</span>
                        <span className="text-xs text-muted-foreground">({ref.referral_code})</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ref.from_facility} &rarr; {ref.to_facility} ({ref.priority})
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-2.5 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>Sử dụng phím mũi tên hoặc chuột để chọn mục</span>
          <span>ESC để đóng</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
