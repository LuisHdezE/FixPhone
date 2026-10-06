export type CustomerRelationshipState = 'active' | 'attention' | 'inactive';
export type CustomerRelationshipFilter = 'all' | CustomerRelationshipState;

export type CustomerSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  petCount: number;
  orderCount: number;
  lastOrderLabel: string;
  lifetimeValueLabel: string;
  relationshipState: CustomerRelationshipState;
};

export type CustomerFilter = {
  search: string;
  relationshipState: CustomerRelationshipFilter;
};

export type CustomersDataState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; customers: readonly CustomerSummary[]; total: number }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

export type CustomersRepository = {
  list(filter: CustomerFilter): Promise<CustomersDataState>;
};
