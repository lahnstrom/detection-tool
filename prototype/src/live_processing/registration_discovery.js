import { fetchRegistration, parseRegistration } from "../ctgov_utils.js";
import { writeRegistrationLiveCache } from "../server_utils.js";

export async function registrationDiscovery(nctId) {
  const rawRegistration = await fetchRegistration(nctId);
  const registration = parseRegistration(rawRegistration);
  writeRegistrationLiveCache(nctId, registration);
  return registration;
}
