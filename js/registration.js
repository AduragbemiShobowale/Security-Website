"use strict";

const form = document.getElementById("registration-form");
const message = document.getElementById("registration-message");
const button = document.getElementById("submit-button");

const whatsappGroups = {
    "Ground Control": "https://chat.whatsapp.com/K9LXgLxnQB24snvvt8MV5x",
    "All Personnel Unit": "https://chat.whatsapp.com/HGE2mjrvfdK0Pez51VmL4f",
    "Central Intelligence": "https://chat.whatsapp.com/IQUdb7l0lPDCCl4aUC8Aff",
    "Access Control & Crowd Management": "https://chat.whatsapp.com/J1I8XsO5OjX8So8LG3u29d",
    "Market Control": "https://chat.whatsapp.com/KVv1rqRBATI76E5W1aGgke",
    "Traffic Control": "https://chat.whatsapp.com/KVv1rqRBATI76E5W1aGgke",
    "Management & Welfare": "https://chat.whatsapp.com/H5mjlhiOGqX2sTWTX7NyXG?s=cl&p=i&ilr=4&iam=0",
    "Advance Unit": "https://chat.whatsapp.com/K0a2f9UdAsyDVn4nkdlgb4"
};

const unitIds = {
    "Central Intelligence": 1,
    "Advance Unit": 2,
    "Access Control & Crowd Management": 3,
    "Ground Control": 4,
    "Management & Welfare": 5,
    "All Personnel Unit": 7,
    "Market Control": 8,
    "Traffic Control": 9
};

function getValue(data, name) {
    const value = data.get(name);
    return value === null ? "" : String(value).trim();
}

function toBoolean(value) {
    return ["yes", "true", "1"].includes(
        String(value).trim().toLowerCase()
    );
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#dc3545" : "#198754";
}

if (form && message && button) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const formData = new FormData(form);

        const groupResult = document.getElementById("whatsapp-group-result");
        const groupLinkElement = document.getElementById("whatsapp-group-link");

        if (groupResult) {
            groupResult.style.display = "none";
        }

        button.disabled = true;
        button.textContent = "Submitting...";

        showMessage("Please wait while your registration is being submitted.");

        try {
            const fullName = getValue(formData, "full_name");

            const contactEmail = getValue(
                formData,
                "contact_email"
            ).toLowerCase();

            const emailAddress = getValue(
                formData,
                "email_address"
            ).toLowerCase();

            const phone = getValue(formData, "phone");

            const selectedUnit = getValue(
                formData,
                "preferred_deployment_unit"
            );

            if (!contactEmail || !emailAddress) {
                throw new Error("Both email fields are required.");
            }

            if (contactEmail !== emailAddress) {
                throw new Error(
                    "Your email addresses do not match. Please check them."
                );
            }

            const unitId = unitIds[selectedUnit];

            if (!unitId) {
                throw new Error("Please select a valid deployment unit.");
            }

            const application = {
                full_name: fullName,
                phone: phone,
                email: contactEmail,
                date_of_birth: getValue(formData, "date_of_birth") || null,
                gender: getValue(formData, "gender"),
                state_of_origin: getValue(formData, "state_of_origin"),
                residential_address: getValue(formData, "residential_address"),
                unit_id: unitId,
                experience: getValue(formData, "experience"),
                experience_details: getValue(formData, "experience_details"),
                declaration: toBoolean(
                    getValue(formData, "declaration")
                ),
                registration_consent: toBoolean(
                    getValue(formData, "registration_consent")
                )
            };

            if (
                !application.full_name ||
                !application.phone ||
                !application.declaration ||
                !application.registration_consent
            ) {
                throw new Error(
                    "Please complete all required registration fields and accept the declaration and consent."
                );
            }

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/submit-registration`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: SUPABASE_KEY
                    },
                    body: JSON.stringify({
                        application: application
                    })
                }
            );

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error(
                    "The server returned an invalid response."
                );
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error ||
                    "Registration failed. Please try again."
                );
            }

            form.reset();

            showMessage(
                "Your registration was successful. Please join your assigned WhatsApp group."
            );

            const groupLink = whatsappGroups[selectedUnit];

            if (groupLink && groupResult && groupLinkElement) {
                groupLinkElement.href = groupLink;
                groupLinkElement.textContent = "Join Your WhatsApp Group";
                groupLinkElement.target = "_blank";
                groupLinkElement.rel = "noopener noreferrer";

                groupResult.style.display = "block";

            } else if (groupLink) {
                const existingButton = document.getElementById(
                    "whatsapp-join-button"
                );

                if (existingButton) {
                    existingButton.remove();
                }

                const joinButton = document.createElement("a");

                joinButton.id = "whatsapp-join-button";
                joinButton.href = groupLink;
                joinButton.target = "_blank";
                joinButton.rel = "noopener noreferrer";
                joinButton.textContent = "Join Your WhatsApp Group";

                joinButton.style.cssText =
                    "display:inline-block;margin-top:15px;padding:13px 22px;background:#25D366;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;";

                message.insertAdjacentElement("afterend", joinButton);
            }

        } catch (error) {
            console.error("Registration error:", error);

            showMessage(
                error.message || "Connection failed. Please try again.",
                true
            );

        } finally {
            button.disabled = false;
            button.textContent = "Submit Registration";
        }
    });
}