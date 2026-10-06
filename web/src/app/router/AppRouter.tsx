import { Navigate, Route, Routes } from 'react-router';
import { JsonPasswordResetContentProvider } from '@/features/authentication/password-reset/infrastructure/JsonPasswordResetContentProvider';
import { MockPasswordResetGateway } from '@/features/authentication/password-reset/infrastructure/MockPasswordResetGateway';
import { PasswordResetPage } from '@/features/authentication/password-reset/presentation/PasswordResetPage';
import { JsonSignInContentProvider } from '@/features/authentication/sign-in/infrastructure/JsonSignInContentProvider';
import { MockSignInGateway } from '@/features/authentication/sign-in/infrastructure/MockSignInGateway';
import { SignInPage } from '@/features/authentication/sign-in/presentation/SignInPage';
import { JsonTwoFactorContentProvider } from '@/features/authentication/two-factor/infrastructure/JsonTwoFactorContentProvider';
import { MockTwoFactorGateway } from '@/features/authentication/two-factor/infrastructure/MockTwoFactorGateway';
import { TwoFactorPage } from '@/features/authentication/two-factor/presentation/TwoFactorPage';
import { JsonInventoryDemoProvider } from '@/features/inventory/infrastructure/JsonInventoryDemoProvider';
import { InventoryDashboardPage } from '@/features/inventory/presentation/InventoryDashboardPage';
import { InventoryDeviceEvaluationPage } from '@/features/inventory/presentation/InventoryDeviceEvaluationPage';
import { InventoryDeviceIntakePage } from '@/features/inventory/presentation/InventoryDeviceIntakePage';
import { InventoryDevicesPage } from '@/features/inventory/presentation/InventoryDevicesPage';
import { JsonMasterDataAdminViewProvider } from '@/features/master-data/infrastructure/JsonMasterDataAdminViewProvider';
import { JsonMasterDataProvider } from '@/features/master-data/infrastructure/JsonMasterDataProvider';
import { MasterDataBrandsPage, MasterDataCategoriesPage, MasterDataDeviceModelsPage } from '@/features/master-data/presentation/MasterDataAdminPages';
import { MasterDataColorsPage, MasterDataConditionsPage, MasterDataRamCapacitiesPage, MasterDataSparePartTypesPage, MasterDataStorageCapacitiesPage } from '@/features/master-data/presentation/ExtendedMasterDataAdminPages';
import { JsonStorefrontProvider } from '@/features/storefront/infrastructure/JsonStorefrontProvider';
import { StorefrontCartPage } from '@/features/storefront/presentation/StorefrontCartPage';
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
import { AccountSettingsPage } from '@/features/user/presentation/AccountSettingsPage';
import { UserProfilePage } from '@/features/user/presentation/UserProfilePage';
import { CustomerDirectoryView } from '@/customers/CustomerDirectoryView';
import { InventoryView } from '@/inventory/InventoryView';
import { OrderListView } from '@/orders/OrderListView';
import { FixPhoneAdminShell } from '@/shell/FixPhoneAdminShell';
import { StorefrontShell } from '@/shell/StorefrontShell';

const passwordResetContentProvider = new JsonPasswordResetContentProvider();
const passwordResetGateway = new MockPasswordResetGateway();
const signInContentProvider = new JsonSignInContentProvider();
const signInGateway = new MockSignInGateway();
const twoFactorContentProvider = new JsonTwoFactorContentProvider();
const twoFactorGateway = new MockTwoFactorGateway();
const inventoryDemoProvider = new JsonInventoryDemoProvider();
const masterDataProvider = new JsonMasterDataProvider();
const masterDataAdminViewProvider = new JsonMasterDataAdminViewProvider();
const storefrontProvider = new JsonStorefrontProvider();

export function AppRouter() {
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

      <Route element={<FixPhoneAdminShell />}>
        <Route index element={<Navigate to="/apps/inventory/dashboard" replace />} />
        <Route path="dashboard" element={<Navigate to="/apps/inventory/dashboard" replace />} />
        <Route path="apps/inventory/dashboard" element={<InventoryDashboardPage provider={inventoryDemoProvider} />} />
        <Route path="apps/inventory/devices" element={<InventoryDevicesPage provider={inventoryDemoProvider} />} />
        <Route path="apps/inventory/devices/new" element={<InventoryDeviceIntakePage masterDataProvider={masterDataProvider} provider={inventoryDemoProvider} />} />
        <Route path="apps/inventory/devices/evaluation" element={<InventoryDeviceEvaluationPage provider={inventoryDemoProvider} />} />
        <Route path="applications/management/inventory" element={<InventoryView />} />
        <Route path="applications/management/customers" element={<CustomerDirectoryView />} />
        <Route path="applications/management/orders" element={<OrderListView />} />
        <Route path="admin/master-data/brands" element={<MasterDataBrandsPage masterDataProvider={masterDataProvider} viewProvider={masterDataAdminViewProvider} />} />
        <Route path="admin/master-data/device-models" element={<MasterDataDeviceModelsPage masterDataProvider={masterDataProvider} viewProvider={masterDataAdminViewProvider} />} />
        <Route path="admin/master-data/categories" element={<MasterDataCategoriesPage masterDataProvider={masterDataProvider} viewProvider={masterDataAdminViewProvider} />} />
        <Route path="admin/master-data/colors" element={<MasterDataColorsPage masterDataProvider={masterDataProvider} />} />
        <Route path="admin/master-data/storage-capacities" element={<MasterDataStorageCapacitiesPage masterDataProvider={masterDataProvider} />} />
        <Route path="admin/master-data/ram-capacities" element={<MasterDataRamCapacitiesPage masterDataProvider={masterDataProvider} />} />
        <Route path="admin/master-data/conditions" element={<MasterDataConditionsPage masterDataProvider={masterDataProvider} />} />
        <Route path="admin/master-data/spare-part-types" element={<MasterDataSparePartTypesPage masterDataProvider={masterDataProvider} />} />
        <Route path="user/profile" element={<UserProfilePage />} />
        <Route path="user/account-settings" element={<AccountSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/apps/inventory/dashboard" replace />} />
    </Routes>
  );
}
