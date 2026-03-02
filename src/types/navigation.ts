export type RootStackParamList = {
  App: undefined;
  Auth: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  AddItem: undefined;
  AddCloset: undefined;
  ItemDetail: { itemId: string };
  ClosetItems: { closetId: string; closetName: string };
};

export type AppTabsParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Add: undefined;
  Outfits: undefined;
  Profile: undefined;
};
