import { useStore } from "@nanostores/react";

import { $imageUrls } from "../store/images";

export const ImageDisplay = () => {
  const urls = useStore($imageUrls);
  const first = urls[0]?.url;

  return (
    <div
      className="h-screen w-full bg-[#111] bg-cover bg-center"
      style={{
        backgroundImage: `url(${first})`,
      }}
    />
  );
};
