import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../lib/axios";
import { toast } from "react-toastify";
import { toggleAuthPopup } from "./popupSlice";

export const register = createAsyncThunk(
  "auth/register", 
  async(data, thunkAPI) => {
    try {
      const res = await axiosInstance.post("auth/register", data);
      toast.success(res.data.message || "Registration Successful!");
      thunkAPI.dispatch(toggleAuthPopup());
      return res.data.user;
    } catch (error) {
      toast.error(error.response.data.message || "Registration Failed");
      return thunkAPI.rejectWithValue(error.response.data.message);
    }
  }
);

export const login = createAsyncThunk(
  "auth/login", 
  async(data, thunkAPI) => {
    try {
      const res = await axiosInstance.post("auth/login", data);
      toast.success(res.data.message || "Login Successful!");
      thunkAPI.dispatch(toggleAuthPopup());
      return res.data.user;
    } catch (error) {
      toast.error(error.response.data.message || "Login Failed");
      return thunkAPI.rejectWithValue(error.response.data.message);
    }
  }
);

export const getUser = createAsyncThunk(
  "auth/profile", 
  async(_, thunkAPI) => {
    try {
      const res = await axiosInstance.get("auth/profile");
      return res.data.user;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data.message || "Failed to get user");
    }
  }
);

export const logout = createAsyncThunk(
  "auth/logout", 
  async(data, thunkAPI) => {
    try {
      const res = await axiosInstance.get("auth/logout");
      thunkAPI.dispatch(toggleAuthPopup());
      return null;
    } catch (error) {
      toast.error(error.response.data.message || "Logout Failed");
      return thunkAPI.rejectWithValue(error.response.data.message || "Logout Failed");
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "auth/forgot-password", 
  async(email, thunkAPI) => {
    try {
      const res = await axiosInstance.post("auth/password/forgot?frontendUrl=http://localhost:5173", email);
      toast.success(res.data.message);
      return null;
    } catch (error) {
      toast.error(error.response.data.message);
      return thunkAPI.rejectWithValue(error.response.data.message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/reset-password", 
  async({ token, password, confirmPassword }, thunkAPI) => {
    try {
      const res = await axiosInstance.put(`auth/password/reset/${token}`, { password, confirmPassword });
      toast.success(res.data.message);
      return res.data.user;
    } catch (error) {
      toast.error(error.response.data.message || "Something went wrong. Please try again.");
      return thunkAPI.rejectWithValue(error.response.data.message);
    }
  }
);

export const updatePassword = createAsyncThunk(
  "auth/update-password", 
  async(data, thunkAPI) => {
    try {
      const res = await axiosInstance.put(`auth/password/update`, data);
      toast.success(res.data.message || "Password updated successfully");
      return null;
    } catch (error) {
      toast.error(error.response.data.message);
      return thunkAPI.rejectWithValue(error.response.data.message);
    }
  }
);

export const updateProfile = createAsyncThunk(
  "auth/update-profile", 
  async(data, thunkAPI) => {
    try {
      const res = await axiosInstance.put(`auth/profile/update`, data);
      toast.success(res.data.message || "Profile updated successfully!");
      return res.data.user;
    } catch (error) {
      toast.error(error.response.data.message);
      return thunkAPI.rejectWithValue(error.response.data.message);
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isUpdatingPassword: false,
    isRequestingForToken: false,
    isCheckingAuth: true,
  },
  extraReducers: (builder) => {
    builder
    .addCase(register.pending, (state) => {
      state.isSigningUp = true;
    })
    .addCase(register.fulfilled, (state, action) => {
      state.isSigningUp = false;
      state.authUser = action.payload;
    })
    .addCase(register.rejected, (state) => {
      state.isSigningUp = false;
    })
    .addCase(login.pending, (state) => {
      state.isLoggingIn = true;
    })
    .addCase(login.fulfilled, (state, action) => {
      state.isLoggingIn = false;
      state.authUser = action.payload;
    })
    .addCase(login.rejected, (state) => {
      state.isLoggingIn = false;
    })
    .addCase(getUser.pending, (state) => {
      state.isCheckingAuth = true;
      state.authUser = null;
    })
    .addCase(getUser.fulfilled, (state, action) => {
      state.isCheckingAuth = false;
      state.authUser = action.payload;
    })
    .addCase(getUser.rejected, (state) => {
      state.isCheckingAuth = false;
      state.authUser = null;
    })
    .addCase(logout.fulfilled, (state, action) => {
      state.authUser = null;
    })
    .addCase(logout.rejected, (state) => {
      state.authUser = state.authUser;
    })
    .addCase(forgotPassword.pending, (state) => {
      state.isRequestingForToken = true;
    })
    .addCase(forgotPassword.fulfilled, (state, action) => {
      state.isRequestingForToken = false;
    })
    .addCase(forgotPassword.rejected, (state) => {
      state.isRequestingForToken = false;
    })
    .addCase(resetPassword.pending, (state) => {
      state.isUpdatingPassword = true;
    })
    .addCase(resetPassword.fulfilled, (state, action) => {
      state.isUpdatingPassword = false;
      state.authUser = action.payload;
    })
    .addCase(resetPassword.rejected, (state) => {
      state.isUpdatingPassword = false;
    })
    .addCase(updatePassword.pending, (state) => {
      state.isUpdatingPassword = true;
    })
    .addCase(updatePassword.fulfilled, (state, action) => {
      state.isUpdatingPassword = false;
    })
    .addCase(updatePassword.rejected, (state) => {
      state.isUpdatingPassword = false;
    })
    .addCase(updateProfile.pending, (state) => {
      state.isUpdatingProfile = true;
    })
    .addCase(updateProfile.fulfilled, (state, action) => {
      state.isUpdatingProfile = false;
      state.authUser = action.payload;
    })
    .addCase(updateProfile.rejected, (state) => {
      state.isUpdatingProfile = false;
    })
  },
});

export default authSlice.reducer;
