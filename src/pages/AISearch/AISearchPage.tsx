import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  BookOpen,
  AlertOctagon,
  Stethoscope,
  BookMarked,
  ArrowRight,
  TrendingUp,
  FileText,
  HelpCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { AISearchResult } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface AISearchPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
}

export const AISearchPage: React.FC<AISearchPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'symptoms' | 'docs'>('symptoms');
  const [query, setQuery] = useState('');
  const [symptomResults, setSymptomResults] = useState<AISearchResult[]>([]);
  const [docResults, setDocResults] = useState<AISearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent, searchText = query) => {
    if (e) e.preventDefault();
    const trimmedQuery = searchText.trim();
    if (trimmedQuery.length < 2) {
      setSearchError('Nhập ít nhất 2 ký tự để tìm kiếm.');
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setHasSearched(false);
    try {
      const response = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery, type: activeTab }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Tìm kiếm thất bại.');

      if (activeTab === 'symptoms') setSymptomResults(payload.results as AISearchResult[]);
      else setDocResults(payload.results as AISearchResult[]);
      setHasSearched(true);
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : 'Không thể kết nối dịch vụ tìm kiếm.');
    } finally {
      setIsSearching(false);
    }
  };

  const sampleQueries = {
    symptoms: [
      'Đau thắt ngực lan ra vai trái khó thở khi gắng sức',
      'Bệnh nhân sốt cao 39 độ nhịp tim nhanh bồn chồn',
      'Ợ chua nóng rát họng ho khan kéo dài về đêm',
      'Khó thở khò khè ho đờm mủ tiền sử hút thuốc lá',
      'Méo miệng, yếu liệt tay chân, nói khó đột ngột',
      'Tiểu buốt, tiểu rắt kèm sốt và đau hông lưng',
    ],
    docs: [
      'Phác đồ sốt xuất huyết Dengue cảnh báo Bộ Y Tế',
      'Khuyến cáo điều trị tăng huyết áp theo phân tầng nguy cơ',
      'Quy trình chuyển tuyến khám bệnh bảo hiểm y tế',
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Tìm Kiếm Thông Minh Y Khoa (AI Semantic Search)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Nhập một hoặc nhiều triệu chứng bằng tiếng Việt. Mô hình đa ngôn ngữ chạy cục bộ tạo vector 384 chiều; Oracle xếp hạng Top-5 bằng VECTOR_DISTANCE với COSINE.
        </p>
      </div>

      {/* DÒNG CẢNH BÁO HỌC THUẬT BẮT BUỘC (MANDATORY ACADEMIC DISCLAIMER) */}
      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <AlertOctagon className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide text-amber-900 dark:text-amber-300">
              Lưu Ý & Cảnh Báo Học Thuật Bắt Buộc (Medical Academic Disclaimer)
            </h3>
            <p className="text-sm mt-1 leading-relaxed text-amber-800 dark:text-amber-300/90">
              Kết quả trả về từ công cụ AI chỉ mang tính chất <strong>tham khảo học thuật, hỗ trợ tra cứu tài liệu và đối chiếu thông tin y khoa</strong>. 
              Tuyệt đối <strong>không được dùng thay thế</strong> cho chẩn đoán lâm sàng, phác đồ điều trị chính thức, hoặc quyết định y khoa chuyên môn của bác sĩ phụ trách. Mọi chỉ định dùng thuốc phải được bác sĩ trực tiếp thăm khám và phê duyệt.
            </p>
          </div>
        </div>
      </div>

      {/* Main Search Input Form */}
      <Card className="shadow-sm border-border">
        <CardContent className="pt-6 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={500}
                aria-label="Mô tả triệu chứng hoặc tài liệu cần tìm"
                placeholder="Nhập mô tả triệu chứng hoặc tên phác đồ y tế bằng tiếng Việt tự nhiên..."
                className="w-full rounded-xl border border-input bg-background pl-11 pr-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={isSearching}
              className="bg-primary text-primary-foreground font-semibold h-12 px-6 rounded-xl shrink-0 shadow-sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isSearching ? 'Đang nhúng vector...' : 'Tìm Kiếm AI (Top-K)'}
            </Button>
          </form>

          {/* Suggested Clickable Queries */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Câu mẫu gợi ý:</span>
            {sampleQueries[activeTab].map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(q);
                  void handleSearch(undefined, q);
                }}
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-accent text-foreground transition-colors border border-border/60"
              >
                {q}
              </button>
            ))}
          </div>
          {searchError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {searchError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2 TAB RIÊNG BIỆT: "TRIỆU CHỨNG" & "TÀI LIỆU Y KHOA" */}
      <Tabs
        defaultValue="symptoms"
        value={activeTab}
        onValueChange={(value) => {
          if (value !== 'symptoms' && value !== 'docs') return;
          setActiveTab(value);
          setHasSearched(false);
        }}
        className="w-full"
      >
        <div className="flex items-center justify-between border-b border-border pb-2">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="symptoms" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              <span>Tab 1: Triệu Chứng Lâm Sàng</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-xs font-mono">
                {symptomResults.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Tab 2: Tài Liệu & Phác Đồ Y Khoa</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-xs font-mono">
                {docResults.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1 font-mono">
            <Layers className="h-3.5 w-3.5" /> Oracle VECTOR_DISTANCE · COSINE · Top-5
          </span>
        </div>

        {/* TAB 1: TRIỆU CHỨNG (Symptom Matching) */}
        <TabsContent value="symptoms" className="mt-4 space-y-4">
          {hasSearched && activeTab === 'symptoms' && (
            <p className="text-sm text-muted-foreground">
              Xếp hạng theo khoảng cách vector cosine; đây không phải xác suất chẩn đoán.
            </p>
          )}
          {activeTab === 'symptoms' && !symptomResults.length && !isSearching && (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {hasSearched ? 'Không có kết quả phù hợp.' : 'Nhập mô tả triệu chứng hoặc chọn câu mẫu để tìm kiếm.'}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4">
            {symptomResults.map((item, index) => (
              <Card
                key={item.id}
                className="hover:border-primary/50 transition-all shadow-sm overflow-hidden"
              >
                <CardHeader className="pb-3 bg-muted/20 border-b border-border/70">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-xs">
                        #{index + 1}
                      </span>
                      <CardTitle className="text-base text-foreground">
                        {item.title}
                      </CardTitle>
                      <Badge variant="blue" className="text-xs">
                        {item.category}
                      </Badge>
                    </div>

                    {/* Vector Distance & Similarity Score */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>Độ gần vector: {item.similarity_score}%</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground text-xs font-mono">
                        Distance: <strong>{item.cosine_distance}</strong>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm text-foreground/90 leading-relaxed">{item.content}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-lg bg-muted/40 border border-border/70">
                      <p className="font-semibold text-foreground mb-1">
                        Chuyên khoa khuyến nghị:
                      </p>
                      <p className="text-blue-700 dark:text-blue-400 font-medium">
                        {item.recommended_specialty}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 border border-border/70">
                      <p className="font-semibold text-foreground mb-1">
                        Khuyến nghị xử trí ban đầu:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        {item.suggested_actions?.map((act, i) => (
                          <li key={i}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Citations */}
                  {item.citations && item.citations.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground border-t border-border/60">
                      <span className="font-semibold text-foreground">Tài liệu tham khảo:</span>
                      {item.citations.map((c, i) => (
                        <span key={i} className="bg-card px-2 py-0.5 rounded border border-border">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: TÀI LIỆU Y KHOA (Medical Literature & Guidelines) */}
        <TabsContent value="docs" className="mt-4 space-y-4">
          {hasSearched && activeTab === 'docs' && (
            <p className="text-sm text-muted-foreground">
              Xếp hạng theo khoảng cách vector cosine; đây không phải xác suất chẩn đoán.
            </p>
          )}
          {activeTab === 'docs' && !docResults.length && !isSearching && (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {hasSearched ? 'Không có kết quả phù hợp.' : 'Nhập từ khóa tài liệu hoặc chọn câu mẫu để tìm kiếm.'}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4">
            {docResults.map((doc, index) => (
              <Card
                key={doc.id}
                className="hover:border-primary/50 transition-all shadow-sm overflow-hidden"
              >
                <CardHeader className="pb-3 bg-muted/20 border-b border-border/70">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-full bg-blue-600/10 text-blue-600 flex items-center justify-center font-mono font-bold text-xs">
                        #{index + 1}
                      </span>
                      <CardTitle className="text-base text-foreground">
                        {doc.title}
                      </CardTitle>
                    </div>

                    {/* Vector Distance & Similarity Score */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>Độ gần vector: {doc.similarity_score}%</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground text-xs font-mono">
                        Distance: <strong>{doc.cosine_distance}</strong>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-3">
                  <Badge variant="outline" className="text-xs">
                    {doc.category}
                  </Badge>
                  <p className="text-sm text-foreground/90 leading-relaxed">{doc.content}</p>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/70 text-xs">
                    <p className="font-semibold text-foreground mb-1">
                      Các bước hành động & Điểm mấu chốt phác đồ:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {doc.suggested_actions?.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>

                  {doc.citations && doc.citations.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground border-t border-border/60">
                      <span className="font-semibold text-foreground">Căn cứ văn bản pháp quy:</span>
                      {doc.citations.map((c, i) => (
                        <span key={i} className="bg-card px-2 py-0.5 rounded border border-border font-medium text-foreground">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
