import { useParams } from "react-router-dom";

import { ShareButton } from "./share-button";
import ThemeToggle from "./theme-toggle";

export const Header = () => {
  const { roomId } = useParams<{ roomId: string }>();
  return (
    <div className="flex w-full items-center justify-between p-4">
      <h1 className="text-2xl font-bold">Logo</h1>

      <div className="flex items-center gap-2">
        <ShareButton roomId={roomId || ""} />
        <ThemeToggle />
      </div>
    </div>
  );
};

export default Header;
