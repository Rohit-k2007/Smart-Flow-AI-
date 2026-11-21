export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001'

export const ROUTES = {
  landing: '/',
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
  simulation: '/simulation',
  aiControl: '/ai-control',
  emergency: '/emergency',
  heatmap: '/heatmap',
  prediction: '/prediction',
  analytics: '/analytics',
  history: '/history',
  settings: '/settings',
} as const
