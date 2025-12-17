import { BaseATSTemplate } from "./BaseATSTemplate";

export const ATSClassic = ({ data }) => {
  return (
    <BaseATSTemplate
      data={data}
      config={{
        fontFamily: "Arial, Helvetica, sans-serif",
        accentColor: "#000000",
        headerAlignment: "center"
      }}
    />
  );
};



