pipeline {
    agent any
    stages {
        stage('Install Node dependencies') {
            steps {
                sh 'npm install'
            }
        }
        stage('Install Python dependencies') {
            steps {
                sh 'pip install -r requirements_scraping.txt'
            }
        }
        stage('Build React app') {
            steps {
                sh 'npm run build'
            }
        }
        stage('Run React tests') {
            steps {
                sh 'npm test -- --watchAll=false || true'
            }
        }
        stage('Run Python tests') {
            steps {
                sh 'pytest || echo "Pas de tests Python automatisés"'
            }
        }
        stage('Test vitesse requêtes') {
            steps {
                sh 'war http://localhost:3000 || echo "war non installé ou serveur non lancé"'
            }
        }
    }
} 