import React, {useEffect, useState} from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Cookie from "js-cookie";

const Home = () :ReactElement => {
  const navigate = useNavigate();
  const checkCookie = async () => {
    const sessionCookie = Cookie.get("scroll-rack-session");
    return await axios.get(`/api/user/session/${sessionCookie}`);
  }

  const q = useQuery({queryKey: ['sessionLookup'], queryFn: checkCookie})
  const user : {username: string, decks: {name: string, id: string}[]} = q.data?.data.user

  const handleClickDeck = (e : React.MouseEvent, id : string) => {
    navigate(`/deck?id=${id}`);
  }
  
  useEffect(() => {
    if (!Cookie.get("scroll-rack-session")){ navigate('/login')}
    console.log(user)
  }, [])

  return (
    <>
      Welcome Home
      <hr/>
      {user && user.decks ? user.decks.map(({name, id}, index) => <a onClick={(e) => handleClickDeck(e, id)} key={name+ index}>{name}</a>) : <>No decks</>}
    </>
  )
}

export default Home;