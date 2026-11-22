export type ApiRole = "FARMER" | "BUYER" | "FIELD_WORKER" | "ADMIN" | "COLLECTION_MANAGER";

export type ApiUser = {
  id: string;
  name: string;
  phone: string;
  role: ApiRole;
};

export type ApiSession = {
  accessToken: string;
  refreshToken: string;
};

export type ApiAuthResponse = ApiSession & {
  user: ApiUser;
  tokenType: "Bearer";
  expiresIn: number;
};

export type ApiUpazila = {
  id: string;
  code: string;
  nameBn: string;
  nameEn: string;
  districtBn: string;
  districtEn: string;
  divisionBn: string;
  divisionEn: string;
};

export type ApiCrop = {
  id: string;
  code: string;
  nameBn: string;
  nameEn: string;
  unit: string;
  isActive: boolean;
};

export type ApiFarmer = {
  id: string;
  userId: string;
  upazilaId: string;
  landSizeAcres: number | string;
  latitude: number | string | null;
  longitude: number | string | null;
  preferredVoice: boolean;
  upazila?: Pick<ApiUpazila, "id" | "nameBn" | "nameEn">;
  user?: Pick<ApiUser, "id" | "name" | "phone">;
};

export type ApiFarmerCrop = {
  id: string;
  farmerId: string;
  cropId: string;
  plantedAt: string | null;
  expectedHarvestAt: string | null;
  areaAcres: number | string | null;
  expectedYieldKg: number | string | null;
  crop?: ApiCrop;
};

export type ApiBuyer = {
  id: string;
  userId: string;
  upazilaId: string;
  buyerType: "WHOLESALER" | "RETAIL_SHOP" | "RESTAURANT" | "PROCESSOR" | "OTHER";
  businessName: string | null;
  address: string | null;
  upazila?: Pick<ApiUpazila, "id" | "nameBn" | "nameEn">;
  user?: Pick<ApiUser, "id" | "name" | "phone">;
};

export type ApiDemand = {
  id: string;
  buyerId: string;
  cropId: string;
  upazilaId: string;
  quantityKg: number | string;
  fulfilledKg: number | string;
  targetPriceBdtKg: number | string | null;
  status: string;
  notesBn: string | null;
  crop?: ApiCrop;
  upazila?: Pick<ApiUpazila, "id" | "nameBn" | "nameEn">;
};

export type ApiCollectionCenter = {
  id: string;
  nameBn: string;
  nameEn: string;
  upazilaId: string;
  capacityKg: number | string | null;
  upazila?: Pick<ApiUpazila, "id" | "nameBn" | "nameEn">;
};

export type ApiCollectionIntake = {
  id: string;
  createdAt: string;
  centerId: string;
  farmerId: string;
  cropId: string;
  receivedKg: number | string;
  acceptedKg: number | string;
  grade: string | null;
  stage: string;
  batchCode: string | null;
  notesBn: string | null;
  crop?: ApiCrop;
  center?: ApiCollectionCenter;
  farmer?: ApiFarmer;
};

export type ApiWorkspace = {
  upazilas: ApiUpazila[];
  crops: ApiCrop[];
  farmerProfile: ApiFarmer | null;
  farmerCropPlans: ApiFarmerCrop[];
  farmers: ApiFarmer[];
  buyerProfile: ApiBuyer | null;
  buyers: ApiBuyer[];
  demands: ApiDemand[];
  collectionCenters: ApiCollectionCenter[];
  collection: ApiCollectionIntake[];
};

export const emptyApiWorkspace: ApiWorkspace = {
  upazilas: [],
  crops: [],
  farmerProfile: null,
  farmerCropPlans: [],
  farmers: [],
  buyerProfile: null,
  buyers: [],
  demands: [],
  collectionCenters: [],
  collection: [],
};
