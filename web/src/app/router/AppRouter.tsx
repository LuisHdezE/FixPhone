import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { ApiStorefrontProvider } from '@/features/storefront/infrastructure/ApiStorefrontProvider';
import { JsonPasswordResetContentProvider } from '@/features/authentication/password-reset/infrastructure/JsonPasswordResetContentProvider';
import { MockPasswordResetGateway } from '@/features/authentication/password-reset/infrastructure/MockPasswordResetGateway';
import { PasswordResetPage } from '@/features/authentication/password-reset/presentation/PasswordResetPage';
import { JsonSignInContentProvider } from '@/features/authentication/sign-in/infrastructure/JsonSignInContentProvider';
import { ApiSignInGateway } from '@/features/authentication/sign-in/infrastructure/ApiSignInGateway';
import { SignInPage } from '@/features/authentication/sign-in/presentation/SignInPage';
import { JsonTwoFactorContentProvider } from '@/features/authentication/two-factor/infrastructure/JsonTwoFactorContentProvider';
import { MockTwoFactorGateway } from '@/features/authentication/two-factor/infrastructure/MockTwoFactorGateway';
import { TwoFactorPage } from '@/features/authentication/two-factor/presentation/TwoFactorPage';
import { ApiInventoryDevicesGateway } from '@/features/inventory/infrastructure/ApiInventoryDevicesGateway';
import { JsonInventoryDemoProvider } from '@/features/inventory/infrastructure/JsonInventoryDemoProvider';
import { InventoryDashboardPage } from '@/features/inventory/presentation/InventoryDashboardPage';
import { InventoryDeviceEvaluationPage } from '@/features/inventory/presentation/InventoryDeviceEvaluationPage';
import { InventoryDeviceIntakePage } from '@/features/inventory/presentation/InventoryDeviceIntakePage';
import { InventoryDevicesPage } from '@/features/inventory/presentation/InventoryDevicesPage';
import { ApiMasterDataGateway } from '@/features/master-data/infrastructure/ApiMasterDataGateway';
import { JsonMasterDataAdminViewProvider } from '@/features/master-data/infrastructure/JsonMasterDataAdminViewProvider';
import { JsonMasterDataProvider } from '@/features/master-data/infrastructure/JsonMasterDataProvider';
import { MasterDataBrandsPage, MasterDataCategoriesPage, MasterDataDeviceModelsPage } from '@/features/master-data/presentation/MasterDataAdminPages';
import { MasterDataColorsPage, MasterDataConditionsPage, MasterDataRamCapacitiesPage, MasterDataSparePartTypesPage, MasterDataStorageCapacitiesPage } from '@/features/master-data/presentation/ExtendedMasterDataAdminPages';
import { JsonStorefrontProvider } from '@/features/storefront/infrastructure/JsonStorefrontProvider';
import { StorefrontCartPage } from '@/features/storefront/presentation/StorefrontCartPage';
import { PartsDonorCatalogPage, PartsDonorDetailPage } from '@/features/storefront/presentation/PartsDonorPages';
import { StorefrontCatalogPage } from '@/features/storefront/presentation/StorefrontCatalogPage';
import { StorefrontCheckoutPage } from '@/features/storefront/presentation/StorefrontCheckoutPage';
import { StorefrontContactPage } from '@/features/storefront/presentation/StorefrontContactPage';
import { StorefrontCustomerIdentityPage } from '@/features/storefront/presentation/StorefrontCustomerIdentityPage';
import { StorefrontFavoritesPage } from '@/features/storefront/presentation/StorefrontFavoritesPage';
import { StorefrontHomePage } from '@/features/storefront/presentation/StorefrontHomePage';
import { StorefrontProductDetailPage } from '@/features/storefront/presentation/StorefrontProductDetailPage';
import { StorefrontProductListingPage } from '@/features/storefront/presentation/StorefrontProductListingPage';
import { StorefrontSessionProvider } from '@/features/storefront/presentation/StorefrontSessionContext';
import { StorefrontShippingPage } from '@/features/storefront/presentation/StorefrontShippingPage';
import { StorefrontWarrantyPage } from '@/features/storefront/presentation/StorefrontWarrantyPage';
import { ValuPhonePage } from '@/features/valuation/presentation/ValuPhonePage';
import { RepairQuotesPage } from '@/features/repair-quotes/presentation/RepairQuotesPage';
import { MediaStorageSettingsPage } from '@/features/media-storage/presentation/MediaStorageSettingsPage';
import { FinancialSettlementsPage } from '@/features/inventory/presentation/FinancialSettlementsPage';
import { AccountSettingsPage } from '@/features/user/presentation/AccountSettingsPage';
import { UserProfilePage } from '@/features/user/presentation/UserProfilePage';
import { CustomerDirectoryView } from '@/customers/CustomerDirectoryView';
import { InventoryView } from '@/inventory/InventoryView';
import { OrderListView } from '@/orders/OrderListView';
import { AuthenticatedAdminShell } from '@/auth/AuthenticatedAdminShell';
import { StorefrontShell } from '@/shell/StorefrontShell';

const passwordResetContentProvider = new JsonPasswordResetContentProvider();
const passwordResetGateway = new MockPasswordResetGateway();
const signInContentProvider = new JsonSignInContentProvider();
const signInGateway = new ApiSignInGateway();
const twoFactorContentProvider = new JsonTwoFactorContentProvider();
const twoFactorGateway = new MockTwoFactorGateway();
const inventoryDemoProvider = new JsonInventoryDemoProvider();
const inventoryDevicesGateway = new ApiInventoryDevicesGateway();
const defaultMasterDataProvider = new JsonMasterDataProvider();
const masterDataGateway = new ApiMasterDataGateway();
const masterDataAdminViewProvider = new JsonMasterDataAdminViewProvider();
const defaultStorefrontProvider = new JsonStorefrontProvider();

export function AppRouter() {
  const [storefrontProvider, setStorefrontProvider] = useState<any>(defaultStorefrontProvider);
  const [error, setError] = useState<string | null>(null);
  const [masterDataProvider, setMasterDataProvider] = useState(defaultMasterDataProvider);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [masterDataError, setMasterDataError] = useState<string | null>(null);
  const location = useLocation();

  const refreshMasterData = useCallback(async () => {
    setMasterDataError(null);
    const catalog = await masterDataGateway.fetchCatalog();
    setMasterDataProvider(new JsonMasterDataProvider(catalog));
  }, []);

  useEffect(() => {
    refreshMasterData()
      .catch((loadError) => setMasterDataError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el catálogo maestro.'))
      .finally(() => setMasterDataLoading(false));
  }, [refreshMasterData]);

  useEffect(() => {
    fetch('/api/v1/store/products')
      .then(res => {
        if (!res.ok) throw new Error('No se pudo conectar con el catálogo en vivo.');
        return res.json();
      })
      .then(products => setStorefrontProvider(new ApiStorefrontProvider(products)))
      .catch(e => setError(e.message));
  }, []);

  const needsMasterData = location.pathname.startsWith('/admin/master-data') || location.pathname === '/apps/inventory/devices/new';

  if (needsMasterData && masterDataLoading) {
    return <div className="grid min-h-dvh place-items-center bg-slate-50 text-sm font-semibold text-slate-600">Cargando catálogo maestro…</div>;
  }

  if (needsMasterData && masterDataError) {
    return <div className="grid min-h-dvh place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><strong>No se pudo cargar el catálogo maestro.</strong><p className="mt-2">{masterDataError}</p></div></div>;
  }

  if (error && location.pathname.startsWith('/store')) {
    return (
      <div className="mx-auto grid max-w-[1440px] gap-3 px-4 py-10 sm:px-5 lg:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-900 shadow-sm max-w-md mx-auto">
          <h2 className="text-lg font-black mb-2">Error de Catálogo</h2>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-4 opacity-70">El backend de inventario no está respondiendo o la base de datos está inaccesible.</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="authentication/sign-in" element={<SignInPage contentProvider={signInContentProvider} gateway={signInGateway} />} />
      <Route path="authentication/password-reset" element={<PasswordResetPage contentProvider={passwordResetContentProvider} gateway={passwordResetGateway} />} />
      <Route path="authentication/two-factor" element={<TwoFactorPage contentProvider={twoFactorContentProvider} gateway={twoFactorGateway} />} />

      <Route element={<StorefrontSessionProvider><StorefrontShell provider={storefrontProvider} /></StorefrontSessionProvider>}>
        <Route path="store" element={<StorefrontHomePage provider={storefrontProvider} />} />
        <Route path="store/products" element={<StorefrontProductListingPage provider={storefrontProvider} />} />
        <Route path="store/spare-parts" element={<StorefrontCatalogPage provider={storefrontProvider} routeKey="spare-parts" />} />
        <Route path="store/used-phones" element={<StorefrontCatalogPage provider={storefrontProvider} routeKey="used-phones" />} />
        <Route path="store/for-parts" element={<PartsDonorCatalogPage />} />
        <Route path="store/for-parts/:id" element={<PartsDonorDetailPage />} />
        <Route path="store/brands" element={<StorefrontCatalogPage provider={storefrontProvider} routeKey="brands" />} />
        <Route path="store/categories/:category" element={<StorefrontCatalogPage provider={storefrontProvider} />} />
        <Route path="store/products/:slug" element={<StorefrontProductDetailPage provider={storefrontProvider} />} />
        <Route path="store/cart" element={<StorefrontCartPage provider={storefrontProvider} />} />
        <Route path="store/favorites" element={<StorefrontFavoritesPage provider={storefrontProvider} />} />
        <Route path="store/checkout" element={<StorefrontCheckoutPage provider={storefrontProvider} />} />
        <Route path="store/shipping" element={<StorefrontShippingPage provider={storefrontProvider} />} />
        <Route path="store/contact" element={<StorefrontContactPage provider={storefrontProvider} />} />
        <Route path="store/warranty" element={<StorefrontWarrantyPage provider={storefrontProvider} />} />
        <Route path="store/account" element={<Navigate to="/store/account/sign-in" replace />} />
        <Route path="store/account/sign-in" element={<StorefrontCustomerIdentityPage mode="sign-in" provider={storefrontProvider} />} />
        <Route path="store/account/register" element={<StorefrontCustomerIdentityPage mode="register" provider={storefrontProvider} />} />
      </Route>

      <Route element={<AuthenticatedAdminShell />}>
        <Route index element={<Navigate to="/apps/inventory/dashboard" replace />} />
        <Route path="dashboard" element={<Navigate to="/apps/inventory/dashboard" replace />} />
        <Route path="apps/inventory/dashboard" element={<InventoryDashboardPage provider={inventoryDemoProvider} />} />
        <Route path="apps/inventory/devices" element={<InventoryDevicesPage provider={inventoryDemoProvider} gateway={inventoryDevicesGateway} />} />
        <Route path="apps/inventory/devices/new" element={<InventoryDeviceIntakePage provider={inventoryDemoProvider} masterDataProvider={masterDataProvider} />} />
        <Route path="apps/inventory/devices/evaluation" element={<InventoryDeviceEvaluationPage provider={inventoryDemoProvider} />} />
        <Route path="applications/management/inventory" element={<InventoryView />} />
        <Route path="applications/management/customers" element={<CustomerDirectoryView />} />
        <Route path="applications/management/orders" element={<OrderListView />} />
        <Route path="admin/master-data/brands" element={<MasterDataBrandsPage masterDataProvider={masterDataProvider} viewProvider={masterDataAdminViewProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/master-data/device-models" element={<MasterDataDeviceModelsPage masterDataProvider={masterDataProvider} viewProvider={masterDataAdminViewProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/master-data/categories" element={<MasterDataCategoriesPage masterDataProvider={masterDataProvider} viewProvider={masterDataAdminViewProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/master-data/colors" element={<MasterDataColorsPage masterDataProvider={masterDataProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/master-data/storage-capacities" element={<MasterDataStorageCapacitiesPage masterDataProvider={masterDataProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/master-data/ram-capacities" element={<MasterDataRamCapacitiesPage masterDataProvider={masterDataProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/master-data/conditions" element={<MasterDataConditionsPage masterDataProvider={masterDataProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/master-data/spare-part-types" element={<MasterDataSparePartTypesPage masterDataProvider={masterDataProvider} gateway={masterDataGateway} onChanged={refreshMasterData} />} />
        <Route path="admin/valuations" element={<ValuPhonePage />} />
        <Route path="admin/repair-quotes" element={<RepairQuotesPage />} />
        <Route path="admin/settings/media-storage" element={<MediaStorageSettingsPage />} />
        <Route path="admin/finance/settlements" element={<FinancialSettlementsPage />} />
        <Route path="user/profile" element={<UserProfilePage />} />
        <Route path="user/account-settings" element={<AccountSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/apps/inventory/dashboard" replace />} />
    </Routes>
  );
}
