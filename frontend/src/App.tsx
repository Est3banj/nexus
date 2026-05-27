import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/admin/ProductsPage'; 
import { ProductDetailPage } from './pages/admin/ProductDetailPage';
import { AddArticlePage } from './pages/admin/AddArticlePage';
import { BrandsPage } from './pages/admin/BrandsPage';
import { StockIntakePage } from './pages/admin/StockIntakePage';
import { StockMovementsPage } from './pages/admin/StockMovementsPage';
import { EmployeeSearchPage } from './pages/employee/EmployeeSearchPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes con Layout */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout title="Panel">
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/products" element={
            <ProtectedRoute requiredRole="admin">
              <Layout title="Catálogo">
                <ProductsPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/products/new" element={
            <ProtectedRoute requiredRole="admin">
              <Layout title="Nuevo Artículo">
                <AddArticlePage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/products/:id" element={
            <ProtectedRoute requiredRole="admin">
              <Layout title="Detalle del Producto">
                <ProductDetailPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/brands" element={
            <ProtectedRoute requiredRole="admin">
              <Layout title="Marcas">
                <BrandsPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/stock-intake/:variantId" element={
            <ProtectedRoute requiredRole="admin">
              <Layout title="Agregar Stock">
                <StockIntakePage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/movements" element={
            <ProtectedRoute requiredRole="admin">
              <Layout title="Movimientos">
                <StockMovementsPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/search" element={
            <ProtectedRoute requiredRole="admin">
              <Layout title="Buscar IMEI">
                <EmployeeSearchPage />
              </Layout>
            </ProtectedRoute>
          } />

           {/* Employee route sin sidebar admin */}
           <Route path="/employee" element={
             <ProtectedRoute>
               <EmployeeSearchPage />
             </ProtectedRoute>
           } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
