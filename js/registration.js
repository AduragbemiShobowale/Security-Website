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

function getValues(data, name) {
    return data.getAll(name).map(value => String(value).trim());
}

function toBoolean(value) {
    return ["yes", "true", "1"].includes(
        String(value).trim().toLowerCase()
    );
}

function toNumberOrNull(value) {
    if (!value) return null;

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#dc3545" : "#198754";
}

const welfareDetails = document.getElementById("welfare-details");
const welfareConsentInputs = form
    ? form.querySelectorAll('input[name="welfare_consent"]')
    : [];

function updateWelfareFields() {
    if (!welfareDetails) return;

    const consent = form.querySelector(
        'input[name="welfare_consent"]:checked'
    );

    const hasConsent = consent && consent.value === "true";

    welfareDetails.style.display = hasConsent ? "block" : "none";

   welfareDetails.querySelectorAll("input, select, textarea").forEach(field => {
    if (!field.hasAttribute("data-original-required")) {
        field.dataset.originalRequired = field.required ? "true" : "false";
    }

    field.disabled = !hasConsent;
    field.required = hasConsent &&
        field.dataset.originalRequired === "true";
});
}

if (form && message && button) {

    welfareConsentInputs.forEach(input => {
        input.addEventListener("change", updateWelfareFields);
    });

    updateWelfareFields();

    form.addEventListener("reset", () => {
        setTimeout(updateWelfareFields, 0);
    });

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const formData = new FormData(form);

        const groupResult = document.getElementById("whatsapp-group-result");
        const groupLinkElement = document.getElementById("whatsapp-group-link");

        if (groupResult) groupResult.style.display = "none";

        button.disabled = true;
        button.textContent = "Submitting...";

        showMessage("Please wait while your application is being submitted.");

        try {
            const fullName = getValue(formData, "full_name");
            const contactEmail = getValue(formData, "contact_email").toLowerCase();
            const emailAddress = getValue(formData, "email_address").toLowerCase();
            const phone = getValue(formData, "phone");
            const selectedUnit = getValue(formData, "preferred_deployment_unit");

            if (!contactEmail || !emailAddress) {
                throw new Error("Both email fields are required.");
            }

            if (contactEmail !== emailAddress) {
                throw new Error("Your email addresses do not match. Please check them.");
            }

            const unitId = unitIds[selectedUnit];

            if (!unitId) {
                throw new Error("Please select a valid deployment unit.");
            }

            const passportPhoto = formData.get("passport_photo");

            if (!(passportPhoto instanceof File) || passportPhoto.size === 0) {
                throw new Error("Please upload your passport photograph.");
            }

            if (passportPhoto.size > 5 * 1024 * 1024) {
                throw new Error("Your passport photograph must not exceed 5 MB.");
            }

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(passportPhoto.type)) {
                throw new Error("Passport photograph must be JPEG, PNG, or WebP.");
            }

            const previousAttendance = getValues(
                formData,
                "previous_ymr_attendance"
            );

            const previousAttendanceOther = getValue(
                formData,
                "previous_ymr_other"
            );

            let previousAttendanceText = previousAttendance.join(", ");

            if (
                previousAttendanceOther &&
                previousAttendance.includes("Others (Please specify)")
            ) {
                previousAttendanceText += `: ${previousAttendanceOther}`;
            }

            const availabilityDays = getValues(
                formData,
                "availability_days"
            );

            const welfareConsent = toBoolean(
                getValue(formData, "welfare_consent")
            );

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
                declaration: toBoolean(getValue(formData, "declaration"))
            };

            const biodata = {
                alternate_phone: getValue(formData, "alternate_phone"),
                local_government_area: getValue(formData, "local_government_area"),
                nationality: getValue(formData, "nationality"),
                occupation: getValue(formData, "occupation"),
                church_name: getValue(formData, "church_name"),
                parish_or_province: getValue(formData, "parish_or_province"),
                pastor_name: getValue(formData, "pastor_name"),
                born_again: getValue(formData, "born_again"),
                born_again_since: getValue(formData, "born_again_since"),
                immersion_baptism: getValue(formData, "immersion_baptism"),
                active_church_worker: getValue(formData, "active_church_worker"),
                church_department: getValue(formData, "church_department"),
                previous_ymr_attendance: previousAttendanceText,
                previous_fl_service: getValue(formData, "previous_fl_service"),
                years_of_service: toNumberOrNull(
                    getValue(formData, "years_of_service")
                ),
                previous_deployment_area: getValue(
                    formData,
                    "previous_deployment_area"
                ),
                preferred_deployment_unit: selectedUnit,
                previous_service_details: "",
                reason_for_joining: getValue(formData, "reason_for_joining"),
                availability_days: availabilityDays,
                briefing_training_availability: getValue(
                    formData,
                    "briefing_training_availability"
                ),
                accommodation_required: toBoolean(
                    getValue(formData, "accommodation_required")
                ),
                accommodation_type: getValue(formData, "accommodation_type"),
                accommodation_price: null,
                accommodation_notes: getValue(formData, "accommodation_notes"),
                referee_one_name: getValue(formData, "referee_one_name"),
                referee_one_phone: getValue(formData, "referee_one_phone"),
                referee_one_relationship_duration: getValue(
                    formData,
                    "referee_one_relationship_duration"
                ),
                referee_two_name: getValue(formData, "referee_two_name"),
                referee_two_phone: getValue(formData, "referee_two_phone"),
                referee_two_relationship_duration: getValue(
                    formData,
                    "referee_two_relationship_duration"
                ),
                passport_photo_path: null,
                consent_to_verification: toBoolean(
                    getValue(formData, "consent_to_verification")
                ),
                dietary_restrictions_details: getValue(
                    formData,
                    "dietary_details"
                ),
                information_accuracy_confirmed: toBoolean(
                    getValue(formData, "information_accuracy_confirmed")
                )
            };

            const welfare = {
                next_of_kin_name: welfareConsent
                    ? getValue(formData, "next_of_kin_name") : null,
                next_of_kin_relationship: welfareConsent
                    ? getValue(formData, "next_of_kin_relationship") : null,
                next_of_kin_phone: welfareConsent
                    ? getValue(formData, "next_of_kin_phone") : null,
                next_of_kin_address: welfareConsent
                    ? getValue(formData, "next_of_kin_address") : null,
                blood_group: welfareConsent
                    ? getValue(formData, "blood_group") : null,
                genotype: welfareConsent
                    ? getValue(formData, "genotype") : null,
                medical_condition: welfareConsent
                    ? toBoolean(getValue(formData, "medical_condition")) : false,
                medical_condition_details: welfareConsent
                    ? getValue(formData, "medical_condition_details") : null,
                allergies: welfareConsent
                    ? toBoolean(getValue(formData, "allergies")) : false,
                allergy_details: welfareConsent
                    ? getValue(formData, "allergy_details") : null,
                dietary_restrictions: welfareConsent
                    ? getValue(formData, "dietary_restrictions") : null,
                other_welfare_information: welfareConsent
                    ? getValue(formData, "other_welfare_information") : null,
                welfare_consent: welfareConsent
            };

            if (
                !application.declaration ||
                !biodata.consent_to_verification ||
                !biodata.information_accuracy_confirmed
            ) {
                throw new Error(
                    "Please accept all required declarations before submitting."
                );
            }

            const submission = new FormData();

            submission.append("application", JSON.stringify(application));
            submission.append("biodata", JSON.stringify(biodata));
            submission.append("welfare", JSON.stringify(welfare));
            submission.append("passport_photo", passportPhoto);

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/submit-application`,
                {
                    method: "POST",
                    headers: {
                        apikey: SUPABASE_KEY
                    },
                    body: submission
                }
            );

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error("The server returned an invalid response.");
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Registration failed. Please try again."
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