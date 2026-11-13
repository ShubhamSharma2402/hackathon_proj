// api/client.js
// All API calls go through this file — one place to update the base URL.
// Simple Axios wrappers that the components call directly.

import axios from 'axios'

// Base URL — Vite proxy forwards /api → http://localhost:3001
const api = axios.create({ baseURL: '/api' })

// --- Catalog ---
export const getFormData      = ()            => api.get('/catalog/form-data')
export const getHotels        = (params)      => api.get('/catalog/hotels', { params })
export const getFlights       = (params)      => api.get('/catalog/flights', { params })
export const getAttractions   = (params)      => api.get('/catalog/attractions', { params })
export const getItemsMeta     = ()            => api.get('/catalog/items-meta')

// --- Packages ---
export const buildPackage     = (request)     => api.post('/packages', request)
export const getPackage       = (id)          => api.get(`/packages/${id}`)
export const getChangeOptions = (id)          => api.get(`/packages/${id}/change-options`)
export const changeCities     = (id, body)    => api.post(`/packages/${id}/change-cities`, body)
export const changeHotel      = (id, body)    => api.patch(`/packages/${id}/hotel`, body)
export const changeFlight     = (id, body)    => api.patch(`/packages/${id}/flight`, body)
export const changeAttractions= (id, body)    => api.patch(`/packages/${id}/attractions`, body)
export const confirmPackage   = (id)          => api.post(`/packages/${id}/confirm`)
export const exportPackage    = (id)          => api.get(`/packages/${id}/export`, { responseType: 'blob' })

// --- Reservations ---
export const getReservation   = (number)      => api.get(`/reservations/${number}`)
