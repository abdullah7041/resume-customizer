import { BaseATSTemplate } from "./BaseATSTemplate.tsx";

const TechnicalTemplate = ({ userData }) => {
    return (
        <BaseATSTemplate
            data={userData}
            config={{
                fontFamily: "'Courier New', Courier, monospace",
                accentColor: "#000000", // Black for ATS compliance
                headerAlignment: "left"
            }}
        />
    );
};

export default TechnicalTemplate;





