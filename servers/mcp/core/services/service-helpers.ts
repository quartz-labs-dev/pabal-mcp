import type { ClientFactoryResult } from "../clients/types";
import type { ServiceResult } from "./types";

export { toErrorMessage } from "../clients/client-factory-helpers";

export const toServiceResult = <T>(
  clientResult: ClientFactoryResult<T>
): ServiceResult<T> =>
  clientResult.success
    ? { success: true, data: clientResult.client }
    : { success: false, error: clientResult.error };
