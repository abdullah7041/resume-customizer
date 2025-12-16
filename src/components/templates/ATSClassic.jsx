import { BaseATSTemplate } from "./BaseATSTemplate.jsx";

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


