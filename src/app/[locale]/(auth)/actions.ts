"use server";

import {
  registerAction as registerServerAction,
  verifyEmailAction as verifyEmailServerAction,
  requestResetAction as requestResetServerAction,
  resetPasswordAction as resetPasswordServerAction,
  signInAction as signInServerAction,
  signOutAction as signOutServerAction,
  updateLocaleAction as updateLocaleServerAction,
  type ActionState,
} from "../(app)/actions";

export type { ActionState };

export async function registerAction(_prev: ActionState, formData: FormData) {
  return registerServerAction(_prev, formData);
}

export async function verifyEmailAction(_prev: ActionState, formData: FormData) {
  return verifyEmailServerAction(_prev, formData);
}

export async function requestResetAction(_prev: ActionState, formData: FormData) {
  return requestResetServerAction(_prev, formData);
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData) {
  return resetPasswordServerAction(_prev, formData);
}

export async function signInAction(_prev: ActionState, formData: FormData) {
  return signInServerAction(_prev, formData);
}

export async function signOutAction() {
  return signOutServerAction();
}

export async function updateLocaleAction(locale: string) {
  return updateLocaleServerAction(locale);
}
