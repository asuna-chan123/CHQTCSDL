import React, { useState } from 'react';
import {
  HeartPulse,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Stethoscope,
  HeartHandshake,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, DEMO_USERS } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

interface AuthPageProps {
  onNavigate: (tab: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onNavigate }) => {
  const { login, loginAsDemo, register } = useAuth();
  const { success, error } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('nguyenvanan@bvbachmai.vn');
  const [password, setPassword] = useState('123456');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('doctor');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      const ok = login(email);
      if (ok) {
        success('Đăng nhập thành công', 'Chào mừng bạn quay lại hệ thống y tế MediCore!');
        onNavigate('dashboard');
      } else {
        error('Đăng nhập thất bại', 'Vui lòng kiểm tra lại thông tin tài khoản.');
      }
    } else {
      if (!name.trim()) {
        error('Thiếu thông tin', 'Vui lòng nhập họ và tên của bạn.');
        return;
      }
      register(name, email, role);
      success('Đăng ký tài khoản thành công', `Chào mừng ${name} đến với hệ thống.`);
      onNavigate('dashboard');
    }
  };

  const handleDemoClick = (userId: string) => {
    loginAsDemo(userId);
    const demoUser = DEMO_USERS.find((u) => u.id === userId);
    success(
      'Đăng nhập vai trò thử nghiệm',
      `Bạn hiện đang đăng nhập với tư cách: ${demoUser?.name} (${demoUser?.roleTitle})`
    );
    onNavigate('dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 space-y-8">
      {/* Brand presentation */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/30 mb-2">
          <HeartPulse className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Cổng Xác Thực & Quản Trị Y Tế MediCore
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
          Nền tảng hồ sơ bệnh án điện tử, phân quyền y bác sĩ và liên thông mạng lưới chuyển tuyến toàn quốc.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: Login / Register Form (7 cols) */}
        <div className="md:col-span-7">
          <Card className="shadow-lg border-border">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {mode === 'login' ? 'Đăng Nhập Hệ Thống' : 'Tạo Tài Khoản Mới'}
                </CardTitle>
                <div className="flex rounded-lg bg-muted p-1 text-xs font-semibold">
                  <button
                    onClick={() => setMode('login')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      mode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    Đăng Nhập
                  </button>
                  <button
                    onClick={() => setMode('register')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      mode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    Đăng Ký
                  </button>
                </div>
              </div>
              <CardDescription>
                {mode === 'login'
                  ? 'Nhập email cơ quan hoặc tài khoản cá nhân để tiếp tục'
                  : 'Điền thông tin và vai trò trong hệ thống bệnh viện'}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <Label required>Họ và Tên</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Ví dụ: Bác sĩ Nguyễn Văn An"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label required>Địa Chỉ Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="bacsi@bvbachmai.vn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label required>Mật Khẩu</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 text-base"
                      required
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <Label required>Vai Trò Trong Bệnh Viện</Label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="doctor">Bác Sĩ Điều Trị / Chuyên Khoa</option>
                      <option value="nurse">Điều Dưỡng Viên</option>
                      <option value="admin">Quản Trị Viên Hệ Thống</option>
                      <option value="patient">Bệnh Nhân / Thân Nhân</option>
                    </select>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 bg-primary text-primary-foreground font-semibold text-base shadow-sm hover:bg-primary/90 mt-2"
                >
                  {mode === 'login' ? 'Xác Nhận Đăng Nhập' : 'Hoàn Tất Đăng Ký'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right: Quick Demo Role Selector (5 cols) */}
        <div className="md:col-span-5 space-y-4">
          <Card className="border-blue-600/30 bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border/70">
              <CardTitle className="text-base flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <CheckCircle2 className="h-5 w-5 text-blue-600" /> Đăng Nhập Nhanh 1-Click (Demo Roles)
              </CardTitle>
              <CardDescription>
                Nhấp vào vai trò dưới đây để lập tức trải nghiệm các quyền hạn y tế khác nhau mà không cần gõ mật khẩu:
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {DEMO_USERS.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleDemoClick(u.id)}
                  className="p-3 rounded-xl border border-border hover:border-blue-600 hover:bg-blue-500/10 cursor-pointer transition-all flex items-center gap-3"
                >
                  <div className="h-11 w-11 rounded-full overflow-hidden border border-border shrink-0">
                    <img src={u.avatar} alt={u.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-foreground truncate">{u.name}</p>
                      <Badge
                        variant={
                          u.role === 'doctor'
                            ? 'blue'
                            : u.role === 'nurse'
                            ? 'warning'
                            : u.role === 'admin'
                            ? 'default'
                            : 'success'
                        }
                        className="text-[10px]"
                      >
                        {u.role === 'doctor' && 'Bác sĩ'}
                        {u.role === 'nurse' && 'Điều dưỡng'}
                        {u.role === 'admin' && 'Admin'}
                        {u.role === 'patient' && 'Bệnh nhân'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.roleTitle}</p>
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-0.5 truncate">{u.email}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Security & HIPAA Notice */}
          <div className="p-4 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Tiêu chuẩn bảo mật dữ liệu y tế
            </p>
            <p className="leading-relaxed">
              Dữ liệu được mã hóa đầu cuối (E2EE), tuân thủ hướng dẫn bảo mật bệnh án điện tử EMR theo Thông tư số 46/2018/TT-BYT.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
