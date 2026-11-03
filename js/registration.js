
"use strict";

const form = document.getElementById("registration-form");
const message = document.getElementById("registration-message");
const button = document.getElementById("submit-button");

const whatsappGroups = {
    "Ground Control": "https://chat.whatsapp.com/K9LXgLxnQB24snvvt8MV5x",
    "All Personnel": "https://chat.whatsapp.com/HGE2mjrvfdK0Pez51VmL4f",
    "Central Intelligence": "https://chat.whatsapp.com/IQUdb7l0lPDCCl4aUC8Aff",
    "Access Control": "https://chat.whatsapp.com/J1I8XsO5OjX8So8LG3u29d",
    "Market Control": "https://chat.whatsapp.com/KVv1rqRBATI76E5W1aGgke",
    "Traffic": "https://chat.whatsapp.com/KVv1rqRBATI76E5W1aGgke",
    "Management & Welfare": "https://chat.whatsapp.com/H5mjlhiOGqX2sTWTX7NyXG?s=cl&p=i&ilr=4&iam=0",
    "Advance Team": "https://chat.whatsapp.com/K0a2f9UdAsyDVn4nkdlgb4"
};

if (form && message && button) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        button.disabled = true;
        button.textContent = "Submitting...";
        message.textContent = "";

        const oldJoinButton = document.getElementById("whatsapp-join-button");
        if (oldJoinButton) oldJoinButton.remove();

        const fullName = document.getElementById("full_name").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const phone = document.getElementById("phone").value.trim();
        const dateOfBirth = document.getElementById("date_of_birth").value;
        const address = document.getElementById("residential_address").value.trim();
        const selectedUnit = document.getElementById("sub_unit").value.trim();

        try {
            // Load the original database's available units.
            const { data: units, error: unitsError } = await supabaseClient
                .from("units")
                .select("id, name");

            if (unitsError) throw unitsError;

            // Match website unit labels to the original database names.
            const unitAliases = {
                "Advance Team": ["Advance Operatives", "Advance Team"],
                "Market Control": [
                    "Market&Traffic Marshals",
                    "Market & Traffic Marshals",
                    "Market Control"
                ],
                "Traffic": [
                    "Market&Traffic Marshals",
                    "Market & Traffic Marshals",
                    "Traffic"
                ],
                "Management & Welfare": [
                    "Welfare",
                    "Management & Welfare"
                ],
                "All Personnel": [
                    "All Personnels",
                    "All Personnel"
                ]
            };

            const acceptedNames = [
                selectedUnit,
                ...(unitAliases[selectedUnit] || [])
            ].map(name => name.trim().toLowerCase());

            const matchingUnit = (units || []).find(unit =>
                acceptedNames.includes(String(unit.name).trim().toLowerCase())
            );

            if (!matchingUnit) {
                throw new Error(
                    "This unit could not be matched to the original database. Please contact the administrator."
                );
            }

            // Save registration to the original database.
            const operative = {
                full_name: fullName,
                email: email,
                phone: phone,
                dob: dateOfBirth || null,
                residential_address: address,
                unit_id: matchingUnit.id,
                status: "pending",
                declaration: true
            };

            const { error: insertError } = await supabaseClient
                .from("operatives")
                .insert([operative]);

            if (insertError) {
                console.error("Registration error:", insertError);

                if (insertError.code === "23505") {
                    throw new Error(
                        "This email or phone number may already be registered."
                    );
                }

                if (insertError.code === "23503") {
                    throw new Error(
                        "The selected unit is invalid. Please contact the administrator."
                    );
                }

                if (insertError.code === "42501") {
                    throw new Error(
                        "The database denied this registration. Please contact the administrator."
                    );
                }

                throw new Error(
                    "Registration failed: " +
                    (insertError.message || "Please try again.")
                );
            }

            message.textContent =
                "Registration successful. Join your sub-unit WhatsApp group below.";

            const groupLink = whatsappGroups[selectedUnit];

            if (groupLink) {
                const joinButton = document.createElement("a");

                joinButton.id = "whatsapp-join-button";
                joinButton.href = groupLink;
                joinButton.target = "_blank";
                joinButton.rel = "noopener noreferrer";
                joinButton.textContent = "Join Your WhatsApp Group";

                joinButton.style.cssText =
                    "display:inline-block;margin-top:15px;padding:12px 20px;background:#25D366;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;";

                message.insertAdjacentElement("afterend", joinButton);
            } else {
                message.textContent =
                    "Registration successful. Please contact the administrator for your WhatsApp group link.";
            }

            form.reset();

        } catch (error) {
            console.error("Registration error:", error);

            message.textContent =
                error.message || "Connection failed. Please try again.";

        } finally {
            button.disabled = false;
            button.textContent = "Submit Registration";
        }
    });
}

