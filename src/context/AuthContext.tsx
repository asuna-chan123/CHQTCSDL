import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types';

export const DEMO_USERS: User[] = [
  {
    id: 'usr-doc-01',
    name: 'BS. CKII Nguyễn Văn An',
    email: 'nguyenvanan@bvbachmai.vn',
    role: 'doctor',
    roleTitle: 'Bác Sĩ Trưởng Khoa Tim Mạch',
    department: 'Khoa Tim Mạch Can Thiệp',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-nur-01',
    name: 'ĐD. Trần Thị Mai',
    email: 'maitran@bvbachmai.vn',
    role: 'nurse',
    roleTitle: 'Điều Dưỡng Trưởng',
    department: 'Khoa Khám Bệnh & Cấp Cứu',
    avatar: 'https://images.unsplash.com/photo-1594824813683-7d9a1029c546?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-adm-01',
    name: 'Lê Hoàng Nam (Admin)',
    email: 'admin@medicore.health.vn',
    role: 'admin',
    roleTitle: 'Quản Trị Viên Hệ Thống Y Tế',
    department: 'Phòng CNTT & Quản Lý Dữ Liệu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-pat-01',
    name: 'Phạm Quang Minh',
    email: 'minh.pham@gmail.com',
    role: 'patient',
    roleTitle: 'Bệnh Nhân',
    department: 'Ngoại trú',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
];

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, role?: UserRole) => boolean;
  loginAsDemo: (userId: string) => void;
  register: (name: string, email: string, role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('medicore_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEMO_USERS[0];
      }
    }
    return DEMO_USERS[0]; // Mặc định bác sĩ
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('medicore_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('medicore_current_user');
    }
  }, [currentUser]);

  const login = (email: string, _role?: UserRole): boolean => {
    const found = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (found) {
      setCurrentUser(found);
      return true;
    }
    // Fallback login
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0],
      email,
      role: 'doctor',
      roleTitle: 'Bác Sĩ Điều Trị',
      department: 'Khoa Nội Tổng Hợp',
    };
    setCurrentUser(newUser);
    return true;
  };

  const loginAsDemo = (userId: string) => {
    const user = DEMO_USERS.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const register = (name: string, email: string, role: UserRole) => {
    const roleTitles: Record<UserRole, string> = {
      doctor: 'Bác Sĩ Điều Trị',
      nurse: 'Điều Dưỡng Viên',
      admin: 'Quản Trị Viên',
      patient: 'Bệnh Nhân',
    };

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role,
      roleTitle: roleTitles[role],
      department: role === 'doctor' || role === 'nurse' ? 'Khoa Nội Tổng Quát' : undefined,
    };
    setCurrentUser(newUser);
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        loginAsDemo,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
