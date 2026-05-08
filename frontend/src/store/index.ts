import { create } from 'zustand';
import api from '../api';

interface User {
  id: number;
  username: string;
  is_superuser: boolean;
  is_active: boolean;
}

interface RobotModule {
  id: number;
  name: string;
  manufacturer?: string;
  peak_torque?: number;
  nominal_torque?: number;
  start_stop_torque?: number;
  stall_torque?: number;
  peak_speed?: number;
  nominal_speed?: number;
  peak_torque_density?: number;
  nominal_torque_density?: number;
  response_time?: number;
  speed_fluctuation?: number;
  torque_fluctuation?: number;
  overload_time_1_5x?: number;
  overload_time_2x?: number;
  overload_time_2_5x?: number;
  overload_time_3x?: number;
  weight?: number;
  reduction_ratio?: number;
  voltage?: number;
  actuator_outer_diameter?: number;
  actuator_hollow_diameter?: number;
  actuator_axial_length?: number;
  stator_inner_diameter?: number;
  stator_outer_diameter?: number;
  rotor_inner_diameter?: number;
  rotor_outer_diameter?: number;
  description?: string;
}

interface AppState {
  token: string | null;
  user: User | null;
  modules: RobotModule[];
  users: User[];
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  fetchUser: () => Promise<void>;
  fetchModules: () => Promise<void>;
  deleteModule: (id: number) => Promise<void>;
  updateModule: (id: number, data: Partial<RobotModule>) => Promise<void>;
  createModule: (data: Partial<RobotModule>) => Promise<void>;
  fetchUsers: () => Promise<void>;
  createUser: (data: Partial<User> & { password?: string }) => Promise<void>;
  updateUser: (id: number, data: Partial<User> & { password?: string }) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  modules: [],
  users: [],
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  setUser: (user) => set({ user }),
  fetchUser: async () => {
    try {
      const res = await api.get('/users/me');
      set({ user: res.data });
    } catch (e) {
      get().setToken(null);
      set({ user: null });
    }
  },
  fetchModules: async () => {
    const res = await api.get('/modules/');
    set({ modules: res.data });
  },
  deleteModule: async (id) => {
    await api.delete(`/modules/${id}`);
    await get().fetchModules();
  },
  updateModule: async (id, data) => {
    await api.put(`/modules/${id}`, data);
    await get().fetchModules();
  },
  createModule: async (data) => {
    await api.post('/modules/', data);
    await get().fetchModules();
  },
  fetchUsers: async () => {
    const res = await api.get('/users/');
    set({ users: res.data });
  },
  createUser: async (data) => {
    await api.post('/users/', data);
    await get().fetchUsers();
  },
  updateUser: async (id, data) => {
    await api.put(`/users/${id}`, data);
    await get().fetchUsers();
  },
  deleteUser: async (id) => {
    await api.delete(`/users/${id}`);
    await get().fetchUsers();
  },
}));
