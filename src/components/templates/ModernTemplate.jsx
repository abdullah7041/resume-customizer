import { BaseATSTemplate } from "./BaseATSTemplate.jsx";

const ModernTemplate = ({ userData }) => {
    return (
        <BaseATSTemplate
            data={userData}
            config={{
                fontFamily: "Roboto, 'Segoe UI', Helvetica, sans-serif",
                accentColor: "#000000", // Black for ATS compliance
                headerAlignment: "left"
            }}
        />
    );
};

export default ModernTemplate;




