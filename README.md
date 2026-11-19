### DATABASE
 Tạo file .env ở trong folder "Bluemoon_Management", với dữ liệu sau:
    `
        DATABASE_USER="postgres"
        DATABASE_PASSWORD="postgres"
        DATABASE_NAME="postgres"
        DATABASE_HOST="localhost"
        DATABASE_PORT=54322

        #Standard PostgreSQL connection URL interpolation
        DATABASE_URL=`postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`
    `

 Chạy `docker compose up -d` để init database trên docker desktop. 
 Truy cập vào `http://localhost:3000/api/seed` để seed database. 
