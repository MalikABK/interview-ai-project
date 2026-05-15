import React,{useState} from 'react'
import { useNavigate, Link, useLocation } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'

const Login = () => {

    const { loading, handleLogin } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")

    const successMessage = location.state?.message

    const handleSubmit = async (e) => {
        e.preventDefault()
        await handleLogin({email,password})
        navigate('/')
    }

    if(loading){
        return (<main><h1>Loading.......</h1></main>)
    }


    return (
        <main>
            <div className="form-container">
                <h1>Login</h1>

                {successMessage && (
                    <div style={{
                        backgroundColor: '#d4edda',
                        color: '#155724',
                        padding: '10px',
                        marginBottom: '15px',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        border: '1px solid #c3e6cb'
                    }}>
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            onChange={(e) => { setEmail(e.target.value) }}
                            type="email" id="email" name='email' placeholder='Enter email address' />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            onChange={(e) => { setPassword(e.target.value) }}
                            type="password" id="password" name='password' placeholder='Enter password' />
                    </div>
                    <button className='button primary-button' >Login</button>
                </form>
                <p>Don't have an account? <Link to={"/register"} >Register</Link> </p>
            </div>
        </main>
    )
}

export default Login