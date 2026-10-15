import { api } from "./axios";

export interface TableData {
  tableId: string;
  tableNumber: number;
}

export interface ValidateTableResponse {
  success: boolean;
  message: string;
  data: TableData;
}

export const validateTable = async (
  tableToken: string,
): Promise<ValidateTableResponse> => {
  const response = await api.get<ValidateTableResponse>(
    `/tables/${tableToken}`,
  );

  return response.data;
};
