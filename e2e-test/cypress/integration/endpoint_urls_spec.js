describe("公開しているエンドポイントのテスト", () => {
    it("Internals", () => {
        cy.request("heartbeat/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("manager/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request({ url: "connector/api/", failOnStatusCode: false }).should(response => {
            expect(response.status).to.eq(401);
        });
        cy.request({ url: "connector/auth/jwt/create", failOnStatusCode: false }).should(response => {
            expect(response.status).to.eq(405);
        });
        cy.request({ url: "silk/", failOnStatusCode: false }).should(response => {
            expect(response.status).to.eq(404);
        });
        cy.request("connector/debug/").should(response => {
            expect(response.status).to.eq(200);
        });
    });
    it("Externals", () => {
        cy.request("connector/debug/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("connector/signup/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("connector/signup-done/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("connector/password-change/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("connector/password-change-done/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("connector/feedback/").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("connector/feedback-done/").should(response => {
            expect(response.status).to.eq(200);
        });
    });
    it("Apps", () => {
        cy.request("camera/camera-app.html?mode=app").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("camera/camera-app.html").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("link/link-app.html?mode=app").should(response => {
            expect(response.status).to.eq(200);
        });
        cy.request("link/link-app.html").should(response => {
            expect(response.status).to.eq(200);
        });
    });
});