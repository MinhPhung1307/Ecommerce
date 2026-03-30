import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../lib/axios";
import { toast } from "react-toastify";
import { toggleAIModal } from "./popupSlice";

export const getAllProducts = createAsyncThunk(
  "product/get-all",
  async ({ 
    availability = "", 
    price = "0-10000", 
    category = "", 
    ratings = "", 
    search = "",
    page = 1 
  }, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if(category) params.append("category", category);
      if(price) params.append("price", price);
      if(search) params.append("search", search);
      if(ratings) params.append("ratings", ratings);
      if(availability) params.append("availability", availability);
      if(page) params.append("page", page);

      const res = await axiosInstance.get(`/product?${params.toString()}`);
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data.message || "Failed to get products.")
    }
  }
);

export const getProduct = createAsyncThunk(
  "product/details", 
  async (id, thunkAPI) => {
    try {
      const res = await axiosInstance.get(`/product/details/${id}`);
      return res.data.product;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data.message || "Failed to get product details.")
    }
  }
);

export const postReview = createAsyncThunk(
  "product/post-new/review", 
  async ({ id, review }, thunkAPI) => {
    try {
      const res = await axiosInstance.put(`/product/post-new/review/${id}`, review);
      toast.success(res.data.message);
      return res.data.review;
    } catch (error) {
      toast.error(error.response.data.message || "Failed to post review.");
      return thunkAPI.rejectWithValue(error.response.data.message || "Failed to post review.");
    }
  }
);

export const deleteReview = createAsyncThunk(
  "product/delete/review", 
  async ({ id, reviewId }, thunkAPI) => {
    try {
      const res = await axiosInstance.delete(`/product/delete/review/${id}`);
      toast.success(res.data.message);
      return reviewId;
    } catch (error) {
      toast.error(error.response.data.message || "Failed to delete review.");
      return thunkAPI.rejectWithValue(error.response.data.message || "Failed to delete review.");
    }
  }
);

export const getProductWithAI = createAsyncThunk(
  "product/ai-search", 
  async (userPrompt, thunkAPI) => {
    try {
      const res = await axiosInstance.post(`/product/ai-search`, userPrompt);
      thunkAPI.dispatch(toggleAIModal());
      return res.data;
    } catch (error) {
      toast.error(error.response.data.message);
      return thunkAPI.rejectWithValue(error.response.data.message || "Failed to get AI filtered products.")
    }
  }
);

const productSlice = createSlice({
  name: "product",
  initialState: {
    loading: false,
    products: [],
    productDetails: {},
    totalProducts: 0,
    topRatedProducts: [],
    newProducts: [],
    aiSearching: false,
    isReviewDeleting: false,
    isPostingReview: false,
    productReviews: [],
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAllProducts.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.products;
        state.newProducts = action.payload.newProducts;
        state.topRatedProducts = action.payload.topRatedProducts;
        state.totalProducts = action.payload.totalProducts;
      })
      .addCase(getAllProducts.rejected, (state) => {
        state.loading = false;
      })
      .addCase(getProduct.pending, (state) => {
        state.loading = true;
      })
      .addCase(getProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.productDetails = action.payload;
        state.productDetails = action.payload.reviews;
      })
      .addCase(getProduct.rejected, (state) => {
        state.loading = false;
      })
      .addCase(postReview.pending, (state) => {
        state.isPostingReview = true;
      })
      .addCase(postReview.fulfilled, (state, action) => {
        state.isPostingReview = false;
        state.productReviews = [...state.productReviews, action.payload];
      })
      .addCase(postReview.rejected, (state) => {
        state.isPostingReview = false;
      })
      .addCase(deleteReview.pending, (state) => {
        state.isReviewDeleting = true;
      })
      .addCase(deleteReview.fulfilled, (state, action) => {
        state.isReviewDeleting = false;
        state.productReviews = state.productReviews.filter(review => review.review_id !== action.payload);
      })
      .addCase(deleteReview.rejected, (state) => {
        state.isReviewDeleting = false;
      })
      .addCase(getProductWithAI.pending, (state) => {
        state.aiSearching = true;
      })
      .addCase(getProductWithAI.fulfilled, (state, action) => {
        state.aiSearching = false;
        state.products = action.payload.products;
        state.totalProducts = action.payload.products.length;
      })
      .addCase(getProductWithAI.rejected, (state) => {
        state.aiSearching = false;
      })
  },
});

export default productSlice.reducer;
