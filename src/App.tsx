import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import GuestRoute from './routes/GuestRoute';
import Leads from './leads/Leads';
import Dashboard from './pages/Dashboard';
import AuthFlow from './pages/AuthFlow';
import CreateLead from './leads/CreateLead';
import LeadDetail from './leads/LeadDetail';
import Users from './pages/Users';
import CreateUser from './pages/CreateUser';
import EditUser from './pages/EditUser';
import Customers from './pages/Customers';
import EditCustomer from './pages/EditCustomer';
import EditLead from './leads/EditLead';
import CreateQuote from './pages/CreateQuote';
import Quote from './pages/Quotes';
import Contact from './pages/Contacts'
import VendorsPage from './pages/Vendors';
import VendorFormPage from './pages/VendorFormPage';
import InvoicesList from './pages/InvoicesListPage';
import CreateInvoice from './pages/CreateInvoicePage';
import Deals from './pages/Deals';
import DealDetails from './pages/DealsDetails';
import SalesReport from './pages/SalesReport';

function App() {
  return (
    <AuthProvider>
        
      <BrowserRouter>
        <Routes>
          {/* Guests only: if logged in, will be redirected to /dashboard */}
          <Route element={<GuestRoute />}>
            <Route path="/auth/*" element={<AuthFlow />} />
          </Route>

          {/* Authenticated only: if not logged in, will be redirected to /auth */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/create" element={<CreateLead />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
<Route path="/leads/:id/edit" element={<EditLead />} />
<Route path="/users" element={<Users />} />
<Route path="/users/create" element={<CreateUser />} />
<Route path="/users/:id/edit" element={<EditUser />} />
<Route path="/customers" element={<Customers />} />
<Route path="/customers/create" element={<EditCustomer />} />
<Route path="/customers/:id/edit" element={<EditCustomer />} />
<Route path="/quote" element={<Quote />} />
<Route path="/create-quote" element={<CreateQuote />} />
<Route path="/contacts" element={<Contact />} />
<Route path="/vendors" element={<VendorsPage />} />
<Route path="/vendors/new" element={<VendorFormPage />} />
<Route path="/vendors/:id/edit" element={<VendorFormPage />} /> 
<Route path="/invoices" element={<InvoicesList />} /> 
<Route path="/invoices/create" element={<CreateInvoice />} /> 
<Route path="/deals" element={<Deals />} /> 
<Route path="/deals/:id" element={<DealDetails />} />
  <Route path="/sales-report" element={<SalesReport/>} />
          </Route>


          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
     
    </AuthProvider>
  );
}

export default App;
