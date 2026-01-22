import { DEFAULT_IMAGES } from "@/shared/config/constants";

export type ProfileData = {
    username: string;
    handle: string;
    profileImage: any;
    bio: string;
    followers: string;
    following: string;
    location: string;
    followedBy: string[];
  };
  
  export const dummyProfileData: ProfileData = {
    username: "Yash",
    handle: "@yashmm",
    profileImage: DEFAULT_IMAGES.user2,
    bio: "nCMO @solana –– janitor @sendaifun & @thesendcoin eco —founder: solana ai hackathon — helping solana founders –– icall out bs + bullpost what i like. nfa",
    followers: "N/A",
    following: "N/A",
    location: "Location",
    followedBy: ["@solana", "@toly", "100K others you know"],
  };
  